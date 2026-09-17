const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

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

describe('PATCH /users/me (sin RF asociado — ver CLAUDE.md)', () => {
  it('actualiza fullName y phone juntos', async () => {
    const registro = await registrar();

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ fullName: 'Nuevo Nombre', phone: '3001234567' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Nuevo Nombre');
    expect(res.body.phone).toBe('3001234567');
  });

  it('actualiza solo phone y conserva el fullName existente', async () => {
    const registro = await registrar({ fullName: 'Nombre Original' });

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ phone: '3009876543' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Nombre Original');
    expect(res.body.phone).toBe('3009876543');
  });

  it('actualiza solo fullName y conserva el phone existente', async () => {
    const registro = await registrar();
    await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ phone: '3001112233' });

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ fullName: 'Otro Nombre' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Otro Nombre');
    expect(res.body.phone).toBe('3001112233');
  });

  it('rechaza un body vacío (422) — al menos un campo es obligatorio', async () => {
    const registro = await registrar();

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).patch('/users/me').send({ fullName: 'Alguien' });
    expect(res.status).toBe(401);
  });

  it('rechaza un fullName vacío (422)', async () => {
    const registro = await registrar();

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ fullName: '' });

    expect(res.status).toBe(422);
  });
});
