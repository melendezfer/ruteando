const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { hashToken } = require('../../src/services/token.service');
const {
  PHONE_VERIFICATION_MAX_ATTEMPTS,
  PHONE_VERIFICATION_RATE_LIMIT_MAX,
} = require('../../src/config/constants');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(role = 'vendor') {
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

async function crearNegocio(vendorToken, categoryId, overrides = {}) {
  const res = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ name: 'Negocio de Prueba', categoryId, ...overrides });
  return res.body;
}

/**
 * Inserta directo un código conocido (mismo criterio que
 * passwordReset.test.js con codigos_recuperacion) — evita depender de
 * mockear smsSender.service.js solo para leer un código que el
 * endpoint real nunca expone en su respuesta.
 */
async function insertarCodigo(negocioId, codigo, { minutosParaExpirar = 10, intentos = 0 } = {}) {
  await pool.query(
    `INSERT INTO codigos_verificacion_telefono (negocio_id, telefono, codigo_hash, intentos, expira_en)
     VALUES ($1, '3001234567', $2, $3, now() + ($4 || ' minutes')::interval)`,
    [negocioId, hashToken(codigo), intentos, minutosParaExpirar],
  );
}

async function activarEstado(negocioId) {
  await pool.query("UPDATE negocios SET estado = 'activo' WHERE id = $1", [negocioId]);
}

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

describe('POST /businesses/{businessId}/phone-verification', () => {
  it('genera un código de verificación (202) para un negocio con teléfono', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      'SELECT * FROM codigos_verificacion_telefono WHERE negocio_id = $1',
      [negocio.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].invalidado_en).toBeNull();
    expect(rows[0].telefono).toBe('3001234567');
  });

  it('rechaza (422) un negocio sin teléfono de contacto', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId); // sin contactPhone

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(422);
  });

  it('rechaza (403) si quien pide no es el dueño del negocio', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const otro = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${otro.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const vendor = await registrar();
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/phone-verification')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('es un no-op si el teléfono ya está verificado (no genera un código nuevo)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await pool.query('UPDATE negocios SET telefono_verificado = true WHERE id = $1', [negocio.id]);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(202);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM codigos_verificacion_telefono WHERE negocio_id = $1',
      [negocio.id],
    );
    expect(rows[0].total).toBe(0);
  });

  it('un código nuevo invalida el anterior todavía activo', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const primero = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(primero.status).toBe(202);

    const segundo = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(segundo.status).toBe(202);

    const { rows } = await pool.query(
      `SELECT invalidado_en FROM codigos_verificacion_telefono WHERE negocio_id = $1 ORDER BY creado_en`,
      [negocio.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].invalidado_en).not.toBeNull();
    expect(rows[1].invalidado_en).toBeNull();
  });

  it(`limita los reenvíos (429 tras ${PHONE_VERIFICATION_RATE_LIMIT_MAX} en la ventana)`, async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    for (let i = 0; i < PHONE_VERIFICATION_RATE_LIMIT_MAX; i++) {
      const res = await request(app)
        .post(`/businesses/${negocio.id}/phone-verification`)
        .set('Authorization', `Bearer ${vendor.accessToken}`);
      expect(res.status).toBe(202);
    }

    const excedido = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(excedido.status).toBe(429);
  });
});

describe('POST /businesses/{businessId}/phone-verification/confirm', () => {
  it('confirma con el código correcto (200) y marca phoneVerified', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '482913');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(true);
  });

  it('rechaza un código incorrecto (401) e incrementa los intentos', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '111111');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '999999' });

    expect(res.status).toBe(401);
    const { rows } = await pool.query(
      'SELECT intentos FROM codigos_verificacion_telefono WHERE negocio_id = $1',
      [negocio.id],
    );
    expect(rows[0].intentos).toBe(1);
  });

  it('rechaza un código vencido (401)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '482913', { minutosParaExpirar: -1 });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });

    expect(res.status).toBe(401);
  });

  it('rechaza (401) cuando no hay ningún código vigente', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });

    expect(res.status).toBe(401);
  });

  it(`bloquea el código tras ${PHONE_VERIFICATION_MAX_ATTEMPTS} intentos fallidos (429), y ni el código correcto sirve después`, async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '482913', { intentos: PHONE_VERIFICATION_MAX_ATTEMPTS });

    const bloqueado = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });
    expect(bloqueado.status).toBe(429);

    const { rows } = await pool.query(
      'SELECT invalidado_en FROM codigos_verificacion_telefono WHERE negocio_id = $1',
      [negocio.id],
    );
    expect(rows[0].invalidado_en).not.toBeNull();
  });

  it('rechaza (422) un código que no son 6 dígitos', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: 'abc123' });

    expect(res.status).toBe(422);
  });

  it('rechaza (403) si quien confirma no es el dueño del negocio', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const otro = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '482913');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${otro.accessToken}`)
      .send({ code: '482913' });

    expect(res.status).toBe(403);
  });

  it('confirmar un negocio ya verificado es idempotente (200), sin exigir un código vigente', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await pool.query('UPDATE negocios SET telefono_verificado = true WHERE id = $1', [negocio.id]);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '000000' });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(true);
  });
});

describe('Visibilidad pública requiere estado activo Y teléfono verificado', () => {
  it('un negocio "activo" pero sin teléfono verificado NO aparece en GET /businesses', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await activarEstado(negocio.id);

    const res = await request(app).get(`/businesses?categoryId=${categoryId}`);
    expect(res.body.data.map((n) => n.id)).not.toContain(negocio.id);
  });

  it('un negocio con teléfono verificado pero todavía "pendiente" tampoco aparece', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await insertarCodigo(negocio.id, '482913');
    await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });

    const res = await request(app).get(`/businesses?categoryId=${categoryId}`);
    expect(res.body.data.map((n) => n.id)).not.toContain(negocio.id);
  });

  it('un negocio "activo" y con teléfono verificado SÍ aparece', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await activarEstado(negocio.id);
    await insertarCodigo(negocio.id, '482913');
    await request(app)
      .post(`/businesses/${negocio.id}/phone-verification/confirm`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ code: '482913' });

    const res = await request(app).get(`/businesses?categoryId=${categoryId}`);
    expect(res.body.data.map((n) => n.id)).toContain(negocio.id);
  });

  it('GET /businesses/{businessId} (perfil directo) sigue siendo visible sin importar la verificación', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });

    const res = await request(app).get(`/businesses/${negocio.id}`);
    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(false);
  });
});

describe('PATCH /businesses/{businessId} resetea phoneVerified si cambia el teléfono', () => {
  it('cambiar a un número distinto resetea phoneVerified a false', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await pool.query('UPDATE negocios SET telefono_verificado = true WHERE id = $1', [negocio.id]);

    const res = await request(app)
      .patch(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: negocio.name, categoryId, contactPhone: '3009999999' });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(false);
  });

  it('reenviar el mismo número no afecta phoneVerified', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar();
    const negocio = await crearNegocio(vendor.accessToken, categoryId, { contactPhone: '3001234567' });
    await pool.query('UPDATE negocios SET telefono_verificado = true WHERE id = $1', [negocio.id]);

    const res = await request(app)
      .patch(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: negocio.name, categoryId, contactPhone: '3001234567' });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(true);
  });
});
