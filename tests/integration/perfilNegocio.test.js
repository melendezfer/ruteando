const crypto = require('node:crypto');
const request = require('supertest');
const sharp = require('sharp');
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

async function registrarVendedorConNegocio(overrides = {}) {
  const email = correoDePrueba();
  const registro = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor', email, password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(registro.body.user.id);

  const categoryId = overrides.categoryId ?? (await crearCategoria());
  const negocio = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${registro.body.accessToken}`)
    .send({ name: overrides.name ?? 'Negocio de Prueba', categoryId });

  return { vendor: registro.body, negocio: negocio.body };
}

async function jpegDePrueba() {
  return sharp({ create: { width: 100, height: 100, channels: 3, background: 'blue' } })
    .jpeg()
    .toBuffer();
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

describe('GET /businesses/{businessId} (perfil público, RF-012)', () => {
  it('un negocio recién creado (sin nada más) da un perfil válido con todo vacío, no un error', async () => {
    const { negocio } = await registrarVendedorConNegocio();

    const res = await request(app).get(`/businesses/${negocio.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: negocio.id, name: negocio.name });
    expect(res.body.location).toBeNull();
    expect(res.body.schedule).toEqual([]);
    expect(res.body.products).toEqual([]);
    expect(res.body.photos).toEqual([]);
    expect(res.body.averageRating).toBeNull();
    expect(res.body.reviewCount).toBe(0);
  });

  it('sigue siendo público (sin auth) aunque el negocio esté pending', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const res = await request(app).get(`/businesses/${negocio.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('embebe ubicación, horario, productos y fotos (de negocio y de producto) en una sola respuesta', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const token = vendor.accessToken;

    await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'stall', latitude: 4.578, longitude: -74.217 });

    await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send([{ day: 'monday', openTime: '08:00', closeTime: '18:00' }]);

    const producto = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Salchipapa', price: 5000 });

    const jpeg = await jpegDePrueba();
    await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, 'negocio.jpg');
    await request(app)
      .post(`/products/${producto.body.id}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, 'producto.jpg');

    const res = await request(app).get(`/businesses/${negocio.id}`);

    expect(res.status).toBe(200);
    expect(res.body.location).toMatchObject({ type: 'stall', latitude: 4.578, longitude: -74.217 });
    expect(res.body.schedule).toEqual([
      { day: 'monday', openTime: '08:00', closeTime: '18:00', closed: false },
    ]);
    expect(res.body.products).toMatchObject([{ id: producto.body.id, name: 'Salchipapa' }]);
    expect(res.body.photos).toHaveLength(2);
    expect(res.body.photos.map((f) => f.type).sort()).toEqual(['business', 'product']);
    // averageRating/reviewCount en null/0: este negocio no tiene ninguna
    // reseña (ni aprobada ni de ningún tipo) — el agregado real sobre
    // reseñas aprobadas de otro negocio se prueba en resenas.test.js.
    expect(res.body.averageRating).toBeNull();
    expect(res.body.reviewCount).toBe(0);
  });

  it('responde 404 (no 500) con un id bien formado pero inexistente', async () => {
    const res = await request(app).get('/businesses/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('rechaza con 401 un token presente pero inválido (optionalAuthenticate no degrada a anónimo)', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const res = await request(app)
      .get(`/businesses/${negocio.id}`)
      .set('Authorization', 'Bearer esto-no-es-un-jwt-valido');
    expect(res.status).toBe(401);
  });
});
