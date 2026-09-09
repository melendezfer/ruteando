/**
 * Limitación real, documentada a propósito (no oculta): estas pruebas
 * mockean src/config/firebaseClient.js — verifican que
 * push.service.js invoca el SDK de Firebase Admin con el payload
 * correcto cuando se crea una solicitud, nunca que un push realmente
 * sonó en un celular. Eso solo se puede probar con un cliente real que
 * registre un token FCM de verdad, y ese cliente todavía no existe (ver
 * CLAUDE.md, sección 11).
 */
const mockFcmSend = jest.fn().mockResolvedValue('mocked-message-id');
jest.mock('../../src/config/firebaseClient', () => ({
  messaging: () => ({ send: (...args) => mockFcmSend(...args) }),
}));

const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX,
} = require('../../src/config/constants');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(role) {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Usuario de Prueba', email, password: 'password123', role });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría de prueba ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function crearNegocioActivo(vendorToken, categoryId) {
  const res = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ name: 'Negocio de Prueba', categoryId });
  await pool.query("UPDATE negocios SET estado = 'activo' WHERE id = $1", [res.body.id]);
  return res.body;
}

async function otorgarConsentimientoNotificaciones(usuarioId) {
  await pool.query(
    `INSERT INTO consentimientos (usuario_id, tipo, texto_version) VALUES ($1, 'notificaciones', 'v1')`,
    [usuarioId],
  );
}

async function registrarTokenDispositivo(usuarioId) {
  const token = `fcm-${crypto.randomUUID()}`;
  await pool.query('INSERT INTO tokens_dispositivo (usuario_id, token) VALUES ($1, $2)', [
    usuarioId,
    token,
  ]);
  return token;
}

/** Vendor "listo": negocio activo + consentimiento + dispositivo registrado. */
async function crearVendorListo() {
  const categoryId = await crearCategoria();
  const vendor = await registrar('vendor');
  const negocio = await crearNegocioActivo(vendor.accessToken, categoryId);
  await otorgarConsentimientoNotificaciones(vendor.user.id);
  await registrarTokenDispositivo(vendor.user.id);
  return { vendor, negocio };
}

afterEach(() => {
  mockFcmSend.mockClear();
});

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  if (categoriaIdsCreadas.length > 0) {
    await pool.query('DELETE FROM categorias WHERE id = ANY($1)', [categoriaIdsCreadas]);
  }
  await pool.end();
});

describe('POST /businesses/{businessId}/availability-requests', () => {
  it('crea la solicitud (pending) y dispara el push al vendedor con el payload correcto', async () => {
    const { negocio } = await crearVendorListo();
    const consumer = await registrar('consumer');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      businessId: negocio.id,
      userId: consumer.user.id,
      status: 'pending',
    });
    expect(res.body.respondedAt).toBeNull();

    expect(mockFcmSend).toHaveBeenCalledTimes(1);
    const payload = mockFcmSend.mock.calls[0][0];
    expect(payload.data).toMatchObject({ type: 'availability_request', businessId: negocio.id });
    expect(typeof payload.notification.title).toBe('string');

    const { rows } = await pool.query(
      'SELECT usuario_id, negocio_id, decision FROM solicitudes_disponibilidad WHERE id = $1',
      [res.body.id],
    );
    expect(rows[0]).toMatchObject({
      usuario_id: consumer.user.id,
      negocio_id: negocio.id,
      decision: null,
    });
  });

  it('un fallo del SDK de push no tumba la solicitud (best-effort)', async () => {
    mockFcmSend.mockRejectedValueOnce(new Error('token inválido'));
    const { negocio } = await crearVendorListo();
    const consumer = await registrar('consumer');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(201);
  });

  it('rechaza con 409 si el negocio no está activo', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Pendiente', categoryId });
    const consumer = await registrar('consumer');

    const res = await request(app)
      .post(`/businesses/${negocio.body.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(409);
  });

  it('rechaza con 409 si el vendedor no ha habilitado notificaciones', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocioActivo(vendor.accessToken, categoryId);
    const consumer = await registrar('consumer');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(409);
  });

  it('rechaza con 403 si el dueño del negocio se solicita a sí mismo', async () => {
    const { vendor, negocio } = await crearVendorListo();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rechaza sin access token (401)', async () => {
    const { negocio } = await crearVendorListo();
    const res = await request(app).post(`/businesses/${negocio.id}/availability-requests`);
    expect(res.status).toBe(401);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/availability-requests')
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(404);
  });

  it(`rechaza con 429 pasado el límite de ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX} solicitudes recientes al mismo negocio, sin importar quién pregunta`, async () => {
    const { negocio } = await crearVendorListo();

    for (let i = 0; i < AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX; i++) {
      const consumer = await registrar('consumer');
      const res = await request(app)
        .post(`/businesses/${negocio.id}/availability-requests`)
        .set('Authorization', `Bearer ${consumer.accessToken}`);
      expect(res.status).toBe(201);
    }

    const bloqueado = await registrar('consumer');
    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${bloqueado.accessToken}`);
    expect(res.status).toBe(429);
  }, 20000);

  it(`rechaza con 429 pasado el límite de ${AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX} solicitudes recientes del mismo usuario, sobre negocios distintos`, async () => {
    const consumer = await registrar('consumer');

    for (let i = 0; i < AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX; i++) {
      const { negocio } = await crearVendorListo();
      const res = await request(app)
        .post(`/businesses/${negocio.id}/availability-requests`)
        .set('Authorization', `Bearer ${consumer.accessToken}`);
      expect(res.status).toBe(201);
    }

    const { negocio: otro } = await crearVendorListo();
    const res = await request(app)
      .post(`/businesses/${otro.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(429);
  }, 20000);
});

describe('GET /availability-requests/{requestId}', () => {
  async function crearSolicitud() {
    const { vendor, negocio } = await crearVendorListo();
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    return { vendor, negocio, consumer, solicitud: res.body };
  }

  it('el consumidor que preguntó puede verla', async () => {
    const { consumer, solicitud } = await crearSolicitud();
    const res = await request(app)
      .get(`/availability-requests/${solicitud.id}`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('el dueño del negocio puede verla', async () => {
    const { vendor, solicitud } = await crearSolicitud();
    const res = await request(app)
      .get(`/availability-requests/${solicitud.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
  });

  it('rechaza con 403 a cualquier otro usuario', async () => {
    const { solicitud } = await crearSolicitud();
    const otro = await registrar('consumer');
    const res = await request(app)
      .get(`/availability-requests/${solicitud.id}`)
      .set('Authorization', `Bearer ${otro.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('calcula status=expired sin que nada lo haya escrito (expiración perezosa)', async () => {
    const { consumer, solicitud } = await crearSolicitud();
    await pool.query(
      "UPDATE solicitudes_disponibilidad SET expira_en = now() - interval '1 minute' WHERE id = $1",
      [solicitud.id],
    );

    const res = await request(app)
      .get(`/availability-requests/${solicitud.id}`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('expired');

    const { rows } = await pool.query(
      'SELECT decision FROM solicitudes_disponibilidad WHERE id = $1',
      [solicitud.id],
    );
    expect(rows[0].decision).toBeNull();
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).get(
      '/availability-requests/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(401);
  });

  it('responde 404 con una solicitud inexistente', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .get('/availability-requests/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /availability-requests/{requestId}/respond', () => {
  async function crearSolicitud() {
    const { vendor, negocio } = await crearVendorListo();
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post(`/businesses/${negocio.id}/availability-requests`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    return { vendor, negocio, consumer, solicitud: res.body };
  }

  it('el dueño confirma (200) y el perfil público muestra availabilityConfirmedAt', async () => {
    const { vendor, negocio, solicitud } = await crearSolicitud();

    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.respondedAt).not.toBeNull();

    const perfil = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfil.body.availabilityConfirmedAt).not.toBeNull();
  });

  it('el dueño declina (200) y el perfil público NO muestra availabilityConfirmedAt', async () => {
    const { vendor, negocio, solicitud } = await crearSolicitud();

    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'declined' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');

    const perfil = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfil.body.availabilityConfirmedAt).toBeNull();
  });

  it('rechaza con 403 a quien no es el dueño del negocio', async () => {
    const { solicitud } = await crearSolicitud();
    const otroVendor = await registrar('vendor');

    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${otroVendor.accessToken}`)
      .send({ decision: 'confirmed' });
    expect(res.status).toBe(403);
  });

  it('rechaza con 409 si ya fue respondida', async () => {
    const { vendor, solicitud } = await crearSolicitud();

    await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'confirmed' });

    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'declined' });
    expect(res.status).toBe(409);
  });

  it('rechaza con 409 si ya expiró', async () => {
    const { vendor, solicitud } = await crearSolicitud();
    await pool.query(
      "UPDATE solicitudes_disponibilidad SET expira_en = now() - interval '1 minute' WHERE id = $1",
      [solicitud.id],
    );

    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'confirmed' });
    expect(res.status).toBe(409);
  });

  it('rechaza un decision fuera del enum (422)', async () => {
    const { vendor, solicitud } = await crearSolicitud();
    const res = await request(app)
      .patch(`/availability-requests/${solicitud.id}/respond`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(422);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app)
      .patch('/availability-requests/00000000-0000-0000-0000-000000000000/respond')
      .send({ decision: 'confirmed' });
    expect(res.status).toBe(401);
  });

  it('responde 404 con una solicitud inexistente', async () => {
    const vendor = await registrar('vendor');
    const res = await request(app)
      .patch('/availability-requests/00000000-0000-0000-0000-000000000000/respond')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ decision: 'confirmed' });
    expect(res.status).toBe(404);
  });
});
