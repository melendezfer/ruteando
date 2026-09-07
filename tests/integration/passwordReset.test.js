const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { hashToken, generateOpaqueToken } = require('../../src/services/token.service');

const usuarioIdsCreados = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(overrides = {}) {
  const body = {
    fullName: 'Usuario de Prueba',
    email: correoDePrueba(),
    password: 'password123',
    role: 'consumer',
    ...overrides,
  };
  const res = await request(app).post('/auth/register').send(body);
  usuarioIdsCreados.push(res.body.user.id);
  return res;
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /auth/forgot-password', () => {
  it('responde igual exista o no la cuenta (no enumeración)', async () => {
    const email = correoDePrueba();
    await registrar({ email });

    const existente = await request(app).post('/auth/forgot-password').send({ email });
    const inexistente = await request(app)
      .post('/auth/forgot-password')
      .send({ email: correoDePrueba() });

    expect(existente.status).toBe(inexistente.status);
    expect(existente.body).toEqual(inexistente.body);
  });

  it('genera un código de recuperación hasheado en la base de datos, nunca en texto plano', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    await request(app).post('/auth/forgot-password').send({ email });

    const { rows } = await pool.query(
      'SELECT codigo_hash FROM codigos_recuperacion WHERE usuario_id = $1',
      [registro.body.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo_hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, no el token crudo
  });

  it('invalida el código anterior si se pide uno nuevo para la misma cuenta', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    await request(app).post('/auth/forgot-password').send({ email });
    const { rows: primeraFila } = await pool.query(
      'SELECT id FROM codigos_recuperacion WHERE usuario_id = $1',
      [registro.body.user.id],
    );

    await request(app).post('/auth/forgot-password').send({ email });

    const { rows } = await pool.query(
      'SELECT id, invalidado_en FROM codigos_recuperacion WHERE usuario_id = $1 ORDER BY creado_en',
      [registro.body.user.id],
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === primeraFila[0].id).invalidado_en).not.toBeNull();
    expect(rows.find((r) => r.id !== primeraFila[0].id).invalidado_en).toBeNull();
  });
});

describe('POST /auth/reset-password', () => {
  it('cambia la contraseña con un token válido y revoca las sesiones existentes', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    const refreshPrevio = registro.body.refreshToken;

    // Generamos el token crudo nosotros mismos (en vez de vía HTTP, porque
    // el endpoint real no expone el valor crudo) y lo insertamos como lo
    // haría el servicio, para poder controlarlo en la prueba.
    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'nuevaClaveSegura456' });
    expect(reset.status).toBe(204);

    const loginViejo = await request(app)
      .post('/auth/login')
      .send({ email, password: 'password123' });
    expect(loginViejo.status).toBe(401);

    const loginNuevo = await request(app)
      .post('/auth/login')
      .send({ email, password: 'nuevaClaveSegura456' });
    expect(loginNuevo.status).toBe(200);

    const refreshTrasReset = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshPrevio });
    expect(refreshTrasReset.status).toBe(401);
  });

  it('rechaza reusar el mismo token (un solo uso)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const primero = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'primeraClaveNueva1' });
    expect(primero.status).toBe(204);

    const segundo = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'segundaClaveNueva2' });
    expect(segundo.status).toBe(401);
  });

  it('rechaza un token expirado (más de 15 minutos)', async () => {
    const registro = await registrar();

    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'nuevaClaveSegura456' });
    expect(res.status).toBe(401);
  });

  it('rechaza un token que nunca existió', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: generateOpaqueToken(), newPassword: 'nuevaClaveSegura456' });
    expect(res.status).toBe(401);
  });
});
