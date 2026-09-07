const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría de prueba ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function registrarVendedorConNegocio() {
  const email = correoDePrueba();
  const registro = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor', email, password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(registro.body.user.id);

  const categoryId = await crearCategoria();
  const negocio = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${registro.body.accessToken}`)
    .send({ name: 'Negocio de Prueba', categoryId });

  return { vendor: registro.body, negocio: negocio.body };
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

describe('POST /businesses/{businessId}/outdated-reports', () => {
  it('acepta un reporte anónimo (sin Authorization) y lo guarda con usuario_id NULL', async () => {
    const { negocio } = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .send({ reason: 'Ya no está en esa ubicación' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      businessId: negocio.id,
      reason: 'Ya no está en esa ubicación',
    });

    const { rows } = await pool.query(
      'SELECT usuario_id, atendido_en FROM reportes_negocio WHERE id = $1',
      [res.body.id],
    );
    expect(rows[0].usuario_id).toBeNull();
    expect(rows[0].atendido_en).toBeNull();
  });

  it('si manda un access token válido, asocia el reporte a ese usuario', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const reportero = await request(app).post('/auth/register').send({
      fullName: 'Reportero',
      email: correoDePrueba(),
      password: 'password123',
      role: 'consumer',
    });
    usuarioIdsCreados.push(reportero.body.user.id);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .set('Authorization', `Bearer ${reportero.body.accessToken}`)
      .send({ reason: 'Cambió de horario' });

    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT usuario_id FROM reportes_negocio WHERE id = $1', [
      res.body.id,
    ]);
    expect(rows[0].usuario_id).toBe(reportero.body.user.id);
  });

  it('rechaza con 401 un token presente pero inválido (no se degrada a anónimo en silencio)', async () => {
    const { negocio } = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .set('Authorization', 'Bearer token-invalido')
      .send({ reason: 'Cualquier cosa' });

    expect(res.status).toBe(401);
  });

  it('responde 404 si el negocio no existe', async () => {
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/outdated-reports')
      .send({ reason: 'Cualquier cosa' });

    expect(res.status).toBe(404);
  });

  it('rechaza un reason vacío (422)', async () => {
    const { negocio } = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .send({ reason: '' });

    expect(res.status).toBe(422);
  });
});
