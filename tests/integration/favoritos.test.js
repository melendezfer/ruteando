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

async function registrar(role, nombre = 'Usuario de Prueba') {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: nombre, email, password: 'password123', role });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

async function crearNegocio(vendorToken, categoryId, name = 'Negocio de Prueba') {
  const res = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ name, categoryId });
  return res.body;
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

describe('POST /businesses/{businessId}/favorite', () => {
  it('marca el negocio como favorito (204)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT 1 FROM favoritos WHERE usuario_id = $1 AND negocio_id = $2',
      [consumer.user.id, negocio.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('es idempotente: marcar dos veces el mismo negocio no da error (204 ambas veces)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const primera = await request(app)
      .post(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    const segunda = await request(app)
      .post(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);

    expect(primera.status).toBe(204);
    expect(segunda.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM favoritos WHERE usuario_id = $1 AND negocio_id = $2',
      [consumer.user.id, negocio.id],
    );
    expect(rows[0].total).toBe(1); // no duplicó la fila
  });

  it('rechaza sin access token (401)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).post(`/businesses/${negocio.id}/favorite`);
    expect(res.status).toBe(401);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/favorite')
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /businesses/{businessId}/favorite', () => {
  it('quita el negocio de favoritos (204)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    await request(app)
      .post(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);

    const res = await request(app)
      .delete(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT 1 FROM favoritos WHERE usuario_id = $1 AND negocio_id = $2',
      [consumer.user.id, negocio.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('es idempotente: quitar un negocio que nunca fue favorito no da error (204)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .delete(`/businesses/${negocio.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(204);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).delete(
      '/businesses/00000000-0000-0000-0000-000000000000/favorite',
    );
    expect(res.status).toBe(401);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .delete('/businesses/00000000-0000-0000-0000-000000000000/favorite')
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /users/me/favorites', () => {
  it('lista solo los favoritos del usuario autenticado, más recientes primero', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const otro = await registrar('consumer');
    const negocio1 = await crearNegocio(vendor.accessToken, categoryId, 'Primero');
    const negocio2 = await crearNegocio(vendor.accessToken, categoryId, 'Segundo');

    await request(app)
      .post(`/businesses/${negocio1.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    await request(app)
      .post(`/businesses/${negocio2.id}/favorite`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    // "otro" marca negocio1 también — no debe aparecer en la lista de consumer
    await request(app)
      .post(`/businesses/${negocio1.id}/favorite`)
      .set('Authorization', `Bearer ${otro.accessToken}`);

    const res = await request(app)
      .get('/users/me/favorites')
      .set('Authorization', `Bearer ${consumer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.name)).toEqual(['Segundo', 'Primero']);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).get('/users/me/favorites');
    expect(res.status).toBe(401);
  });

  it('pagina con cursor (limit=1) sin saltar ni repetir favoritos', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocios = [];
    for (let i = 0; i < 3; i++) {
      const negocio = await crearNegocio(vendor.accessToken, categoryId, `Negocio ${i}`);
      await request(app)
        .post(`/businesses/${negocio.id}/favorite`)
        .set('Authorization', `Bearer ${consumer.accessToken}`);
      negocios.push(negocio.id);
    }

    const vistos = [];
    let cursor;
    for (let i = 0; i < 3; i++) {
      const url = cursor
        ? `/users/me/favorites?limit=1&cursor=${encodeURIComponent(cursor)}`
        : '/users/me/favorites?limit=1';
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${consumer.accessToken}`);
      expect(res.body.data).toHaveLength(1);
      vistos.push(res.body.data[0].id);
      cursor = res.body.pagination.nextCursor;
    }
    expect(vistos.sort()).toEqual([...negocios].sort());
  });

  it('rechaza un cursor corrupto (422, no 500)', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .get('/users/me/favorites?cursor=esto-no-es-un-cursor')
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(422);
  });
});
