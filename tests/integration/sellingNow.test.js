const mockFcmSend = jest.fn().mockResolvedValue('mocked-message-id');
jest.mock('../../src/config/firebaseClient', () => ({
  messaging: () => ({ send: (...args) => mockFcmSend(...args) }),
}));

const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { momentoActualBogota } = require('../../src/services/disponibilidad.service');
const { DAY_DB_TO_API } = require('../../src/services/business.mapper');
const { SELLING_NOW_DAILY_MAX } = require('../../src/config/constants');

/**
 * R5 — "Estoy vendiendo ahora" (docs/specs/r5-estoy-vendiendo.md):
 * PUT/DELETE /businesses/{businessId}/selling-now y la regla "el aviso más
 * reciente manda" entre avisos propios y respuestas a preguntas.
 */
const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];
const CENTRO = { lat: 4.6083, lng: -74.2188 };
const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Cat venta ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function registrar(role = 'vendor') {
  const r = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Persona', email: `test-${crypto.randomUUID()}@ruteando.test`, password: 'password123', role });
  usuarioIdsCreados.push(r.body.user.id);
  return { token: r.body.accessToken, userId: r.body.user.id };
}

/** Negocio con base en CENTRO; abierto todo el día salvo `abierto: false`. */
async function crearNegocio({ estado = 'activo', abierto = true, mobility = 'street_stall', telefonoVerificado = true } = {}) {
  const vendor = await registrar();
  const categoryId = await crearCategoria();
  const n = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendor.token}`)
    .send({ name: `Venta ${crypto.randomUUID().slice(0, 6)}`, categoryId, mobility });
  await request(app)
    .put(`/businesses/${n.body.id}/location`)
    .set('Authorization', `Bearer ${vendor.token}`)
    .send({ type: 'fixed', latitude: CENTRO.lat, longitude: CENTRO.lng, showExactLocation: true });
  await request(app)
    .put(`/businesses/${n.body.id}/schedule`)
    .set('Authorization', `Bearer ${vendor.token}`)
    .send(DIAS.map((day) => (abierto ? { day, openTime: '00:00', closeTime: '23:59' } : { day, closed: true })));
  await pool.query('UPDATE negocios SET estado = $2, telefono_verificado = $3 WHERE id = $1', [
    n.body.id,
    estado,
    telefonoVerificado,
  ]);
  return { id: n.body.id, token: vendor.token, userId: vendor.userId, categoryId };
}

const avisar = (id, token) => request(app).put(`/businesses/${id}/selling-now`).set('Authorization', `Bearer ${token}`);
const dejar = (id, token) => request(app).delete(`/businesses/${id}/selling-now`).set('Authorization', `Bearer ${token}`);
const perfil = async (id) => (await request(app).get(`/businesses/${id}`)).body;

async function contarSenales(id) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM senales_venta WHERE negocio_id = $1', [id]);
  return rows[0].n;
}

/** Mueve al pasado todos los avisos propios del negocio (sin esperar de verdad). */
async function envejecer(id, minutos) {
  await pool.query(
    `UPDATE senales_venta SET fecha_creacion = fecha_creacion - make_interval(mins => $2) WHERE negocio_id = $1`,
    [id, minutos],
  );
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM eventos WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM consentimientos WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  if (categoriaIdsCreadas.length > 0) {
    await pool.query('DELETE FROM categorias WHERE id = ANY($1)', [categoriaIdsCreadas]);
  }
  await pool.end();
});

describe('PUT /businesses/{businessId}/selling-now — reglas', () => {
  it('401 sin token, 403 a otro vendedor y a un consumidor, 404 negocio inexistente', async () => {
    const { id } = await crearNegocio();
    const otro = await registrar();
    const consumidor = await registrar('consumer');
    expect((await request(app).put(`/businesses/${id}/selling-now`)).status).toBe(401);
    expect((await avisar(id, otro.token)).status).toBe(403);
    expect((await avisar(id, consumidor.token)).status).toBe(403);
    expect((await avisar(crypto.randomUUID(), otro.token)).status).toBe(404);
    expect((await dejar(id, otro.token)).status).toBe(403);
    expect(await contarSenales(id)).toBe(0);
  });

  it.each(['pendiente', 'rechazado', 'suspendido', 'cerrado'])('409 si el negocio está %s', async (estado) => {
    const { id, token } = await crearNegocio({ estado });
    expect((await avisar(id, token)).status).toBe(409);
  });

  it('409 con type selling-now-off-schedule fuera de su horario', async () => {
    const { id, token } = await crearNegocio({ abierto: false });
    const res = await avisar(id, token);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/selling-now-off-schedule$/);
    expect(await contarSenales(id)).toBe(0);
  });

  it('un ambulante cerrado por horario pero dentro de una franja vigente sí puede avisar', async () => {
    const { id, token } = await crearNegocio({ abierto: false, mobility: 'itinerant' });
    const hoy = DAY_DB_TO_API[momentoActualBogota().hoyDb];
    await request(app)
      .put(`/businesses/${id}/location-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send([{ day: hoy, startTime: '00:00', endTime: '23:59', latitude: CENTRO.lat, longitude: CENTRO.lng }]);
    expect((await avisar(id, token)).status).toBe(200);
  });
});

describe('PUT /businesses/{businessId}/selling-now — aviso', () => {
  it('guarda el aviso, vence en 60 min, registra el evento y se ve en perfil, listado, cercanos y favoritos', async () => {
    const { id, token, userId, categoryId } = await crearNegocio();
    const res = await avisar(id, token);
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    const confirmado = new Date(res.body.availabilityConfirmedAt).getTime();
    expect(new Date(res.body.expiresAt).getTime() - confirmado).toBe(60 * 60 * 1000);

    expect((await perfil(id)).availabilityConfirmedAt).toBe(res.body.availabilityConfirmedAt);

    const listado = await request(app).get('/businesses').query({ categoryId });
    expect(listado.body.data.find((b) => b.id === id).availabilityConfirmedAt).not.toBeNull();

    const cercanos = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, categoryId });
    expect(cercanos.body.data.find((b) => b.id === id).availabilityConfirmedAt).not.toBeNull();

    const consumidor = await registrar('consumer');
    await request(app).post(`/businesses/${id}/favorite`).set('Authorization', `Bearer ${consumidor.token}`);
    const favoritos = await request(app).get('/users/me/favorites').set('Authorization', `Bearer ${consumidor.token}`);
    expect(favoritos.body.data.find((b) => b.id === id).availabilityConfirmedAt).not.toBeNull();

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM eventos WHERE negocio_id = $1 AND usuario_id = $2 AND tipo = 'confirmacion_venta'`,
      [id, userId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('un segundo toque antes de 5 min no crea fila (saved: false) y conserva la fecha', async () => {
    const { id, token } = await crearNegocio();
    const primero = await avisar(id, token);
    const segundo = await avisar(id, token);
    expect(segundo.status).toBe(200);
    expect(segundo.body.saved).toBe(false);
    expect(segundo.body.availabilityConfirmedAt).toBe(primero.body.availabilityConfirmedAt);
    expect(await contarSenales(id)).toBe(1);
  });

  it('pasados 5 min, "Sigo vendiendo" renueva con una fecha nueva', async () => {
    const { id, token } = await crearNegocio();
    const primero = await avisar(id, token);
    await envejecer(id, 6);
    const segundo = await avisar(id, token);
    expect(segundo.body.saved).toBe(true);
    expect(new Date(segundo.body.availabilityConfirmedAt).getTime()).toBeGreaterThan(
      new Date(primero.body.availabilityConfirmedAt).getTime(),
    );
  });

  it('vence solo a los 60 minutos, sin que nada lo escriba', async () => {
    const { id, token } = await crearNegocio();
    await avisar(id, token);
    await envejecer(id, 59);
    expect((await perfil(id)).availabilityConfirmedAt).not.toBeNull();
    await envejecer(id, 2);
    expect((await perfil(id)).availabilityConfirmedAt).toBeNull();
  });

  it('dos toques simultáneos crean una sola fila', async () => {
    const { id, token } = await crearNegocio();
    const respuestas = await Promise.all([avisar(id, token), avisar(id, token), avisar(id, token)]);
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    expect(await contarSenales(id)).toBe(1);
  });

  it(`429 pasado el tope de ${SELLING_NOW_DAILY_MAX} avisos en 24 h; "Ya no estoy vendiendo" sigue funcionando`, async () => {
    const { id, token, userId } = await crearNegocio();
    await pool.query(
      `INSERT INTO senales_venta (negocio_id, usuario_id, senal, fecha_creacion)
       SELECT $1, $2, 'vendiendo', now() - interval '10 minutes' - (g * interval '1 minute')
       FROM generate_series(1, $3) g`,
      [id, userId, SELLING_NOW_DAILY_MAX],
    );
    const res = await avisar(id, token);
    expect(res.status).toBe(429);
    expect((await perfil(id)).availabilityConfirmedAt).not.toBeNull();
    expect((await dejar(id, token)).status).toBe(204);
    expect((await perfil(id)).availabilityConfirmedAt).toBeNull();
  });

  it('el aviso no hace visible un negocio que las reglas de siempre dejan afuera (teléfono sin verificar)', async () => {
    const { id, token, categoryId } = await crearNegocio({ telefonoVerificado: false });
    expect((await avisar(id, token)).status).toBe(200);
    const listado = await request(app).get('/businesses').query({ categoryId });
    expect(listado.body.data.find((b) => b.id === id)).toBeUndefined();
  });
});

describe('DELETE /businesses/{businessId}/selling-now', () => {
  it('apaga el aviso de inmediato', async () => {
    const { id, token } = await crearNegocio();
    await avisar(id, token);
    expect((await dejar(id, token)).status).toBe(204);
    expect((await perfil(id)).availabilityConfirmedAt).toBeNull();
    expect(await contarSenales(id)).toBe(2);
  });

  it('sin aviso vigente es un no-op (204, sin fila nueva)', async () => {
    const { id, token } = await crearNegocio();
    expect((await dejar(id, token)).status).toBe(204);
    expect(await contarSenales(id)).toBe(0);
  });

  it('volver a avisar justo después de apagar funciona (no lo frena el intervalo mínimo)', async () => {
    const { id, token } = await crearNegocio();
    await avisar(id, token);
    await dejar(id, token);
    const res = await avisar(id, token);
    expect(res.body.saved).toBe(true);
    expect((await perfil(id)).availabilityConfirmedAt).not.toBeNull();
  });
});

describe('el aviso más reciente manda (propio o respuesta a una pregunta)', () => {
  async function negocioConPreguntas() {
    const negocio = await crearNegocio();
    await pool.query(
      `INSERT INTO consentimientos (usuario_id, tipo, texto_version) VALUES ($1, 'notificaciones', 'v1')`,
      [negocio.userId],
    );
    const preguntar = async () => {
      const consumidor = await registrar('consumer');
      const res = await request(app)
        .post(`/businesses/${negocio.id}/availability-requests`)
        .set('Authorization', `Bearer ${consumidor.token}`);
      return res.body.id;
    };
    const responder = (requestId, decision) =>
      request(app)
        .patch(`/availability-requests/${requestId}/respond`)
        .set('Authorization', `Bearer ${negocio.token}`)
        .send({ decision });
    return { ...negocio, preguntar, responder };
  }

  it('aviso propio y después "no" a una pregunta: se apaga', async () => {
    const n = await negocioConPreguntas();
    await avisar(n.id, n.token);
    await envejecer(n.id, 1); // el "no" tiene que ser posterior
    const pregunta = await n.preguntar();
    await n.responder(pregunta, 'declined');
    expect((await perfil(n.id)).availabilityConfirmedAt).toBeNull();
  });

  it('"Ya no estoy vendiendo" y después "sí" a una pregunta: vuelve a estar vigente', async () => {
    const n = await negocioConPreguntas();
    await avisar(n.id, n.token);
    await dejar(n.id, n.token);
    await envejecer(n.id, 1);
    const pregunta = await n.preguntar();
    await n.responder(pregunta, 'confirmed');
    expect((await perfil(n.id)).availabilityConfirmedAt).not.toBeNull();
  });

  it('"sí" a una pregunta y después "Ya no estoy vendiendo": se apaga', async () => {
    const n = await negocioConPreguntas();
    const pregunta = await n.preguntar();
    await n.responder(pregunta, 'confirmed');
    expect((await dejar(n.id, n.token)).status).toBe(204);
    expect((await perfil(n.id)).availabilityConfirmedAt).toBeNull();
  });

  it('un "sí" reciente cuenta para el intervalo mínimo del aviso propio', async () => {
    const n = await negocioConPreguntas();
    const pregunta = await n.preguntar();
    await n.responder(pregunta, 'confirmed');
    const res = await avisar(n.id, n.token);
    expect(res.body.saved).toBe(false);
    expect(await contarSenales(n.id)).toBe(0);
  });
});
