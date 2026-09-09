const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const usuarioIdsCreados = [];

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

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /users/me/device-tokens', () => {
  it('registra el token del dispositivo actual (204)', async () => {
    const consumer = await registrar('consumer');
    const token = `fcm-${crypto.randomUUID()}`;

    const res = await request(app)
      .post('/users/me/device-tokens')
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ token });
    expect(res.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT usuario_id FROM tokens_dispositivo WHERE token = $1',
      [token],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].usuario_id).toBe(consumer.user.id);
  });

  it('reasigna el token a la nueva cuenta si el mismo dispositivo cambia de usuario', async () => {
    const primero = await registrar('consumer');
    const segundo = await registrar('consumer');
    const token = `fcm-${crypto.randomUUID()}`;

    await request(app)
      .post('/users/me/device-tokens')
      .set('Authorization', `Bearer ${primero.accessToken}`)
      .send({ token });

    await request(app)
      .post('/users/me/device-tokens')
      .set('Authorization', `Bearer ${segundo.accessToken}`)
      .send({ token });

    const { rows } = await pool.query(
      'SELECT usuario_id FROM tokens_dispositivo WHERE token = $1',
      [token],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].usuario_id).toBe(segundo.user.id);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).post('/users/me/device-tokens').send({ token: 'x' });
    expect(res.status).toBe(401);
  });

  it('rechaza sin token en el body (422)', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post('/users/me/device-tokens')
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({});
    expect(res.status).toBe(422);
  });
});
