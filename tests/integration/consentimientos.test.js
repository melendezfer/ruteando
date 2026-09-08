const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const usuarioIdsCreados = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(nombre = 'Usuario de Prueba') {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: nombre, email, password: 'password123', role: 'consumer' });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /consents', () => {
  it('registra el consentimiento asociado al usuario autenticado (201)', async () => {
    const usuario = await registrar();

    const res = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'data_processing', textVersion: 'v1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      type: 'data_processing',
      textVersion: 'v1',
      grantedByThirdParty: false,
      userId: usuario.user.id,
      businessId: null,
    });
    expect(typeof res.body.grantedAt).toBe('string');
  });

  it('rechaza sin access token (401) — no hay a quién asociar el consentimiento todavía', async () => {
    const res = await request(app)
      .post('/consents')
      .send({ type: 'data_processing', textVersion: 'v1' });
    expect(res.status).toBe(401);
  });

  it('un token presente pero inválido también da 401 (tryAuthenticate deja pasar al handler, que exige auth)', async () => {
    const res = await request(app)
      .post('/consents')
      .set('Authorization', 'Bearer esto-no-es-un-jwt-valido')
      .send({ type: 'data_processing', textVersion: 'v1' });
    expect(res.status).toBe(401);
  });

  it('rechaza un type fuera del enum (422)', async () => {
    const usuario = await registrar();
    const res = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'not_a_real_type', textVersion: 'v1' });
    expect(res.status).toBe(422);
  });

  it('permite otorgar el mismo tipo más de una vez (append-only, no hay UNIQUE que lo impida)', async () => {
    const usuario = await registrar();

    const primero = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'terms_conditions', textVersion: 'v1' });
    const segundo = await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'terms_conditions', textVersion: 'v2' });

    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(201);
    expect(primero.body.id).not.toBe(segundo.body.id);

    const { rows } = await pool.query(
      "SELECT texto_version FROM consentimientos WHERE usuario_id = $1 AND tipo = 'terminos_condiciones' ORDER BY fecha_otorgado",
      [usuario.user.id],
    );
    expect(rows.map((r) => r.texto_version)).toEqual(['v1', 'v2']); // ambas filas siguen, ninguna se editó ni se borró
  });
});

describe('GET /users/me/consents', () => {
  it('devuelve el historial completo del usuario autenticado, más reciente primero', async () => {
    const usuario = await registrar();

    await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'data_processing', textVersion: 'v1' });
    await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ type: 'terms_conditions', textVersion: 'v1' });

    const res = await request(app)
      .get('/users/me/consents')
      .set('Authorization', `Bearer ${usuario.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.type)).toEqual(['terms_conditions', 'data_processing']);
  });

  it('no devuelve el historial de otro usuario', async () => {
    const usuarioA = await registrar();
    const usuarioB = await registrar();

    await request(app)
      .post('/consents')
      .set('Authorization', `Bearer ${usuarioA.accessToken}`)
      .send({ type: 'data_processing', textVersion: 'v1' });

    const res = await request(app)
      .get('/users/me/consents')
      .set('Authorization', `Bearer ${usuarioB.accessToken}`);

    expect(res.body).toEqual([]);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).get('/users/me/consents');
    expect(res.status).toBe(401);
  });
});
