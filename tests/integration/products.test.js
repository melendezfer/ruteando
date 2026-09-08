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

  return { vendor: registro.body, negocio: negocio.body, categoryId };
}

async function crearProducto(accessToken, businessId, overrides = {}) {
  const res = await request(app)
    .post(`/businesses/${businessId}/products`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Salchipapa', price: 8500, ...overrides });
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

describe('POST /businesses/{businessId}/products', () => {
  it('crea el producto cuando lo hace el dueño del negocio (201)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Empanada', description: 'De carne', price: 2500 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      businessId: negocio.id,
      name: 'Empanada',
      description: 'De carne',
      price: 2500,
      available: true,
    });
  });

  it('rechaza con 403 a quien no es el dueño del negocio', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const otro = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`)
      .send({ name: 'Robado', price: 1000 });

    expect(res.status).toBe(403);
  });

  it('rechaza sin access token (401)', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .send({ name: 'X', price: 1000 });
    expect(res.status).toBe(401);
  });

  it('rechaza un body sin price (422)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(422);
  });

  it('rechaza un negocio inexistente (404)', async () => {
    const { vendor } = await registrarVendedorConNegocio();
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/products')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'X', price: 1000 });
    expect(res.status).toBe(404);
  });
});

describe('GET /businesses/{businessId}/products', () => {
  it('es público y lista los productos del negocio', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    await crearProducto(vendor.accessToken, negocio.id, { name: 'Producto A' });
    await crearProducto(vendor.accessToken, negocio.id, { name: 'Producto B' });

    const res = await request(app).get(`/businesses/${negocio.id}/products`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /products/{productId}', () => {
  it('es público y devuelve el detalle', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);

    const res = await request(app).get(`/products/${producto.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(producto.id);
  });

  it('responde 404 (no 500) con un id mal formado', async () => {
    const res = await request(app).get('/products/esto-no-es-un-uuid');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /products/{productId}', () => {
  it('permite editar al dueño del negocio y conserva campos no enviados (parche parcial real)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id, {
      description: 'Descripción original',
    });

    const res = await request(app)
      .patch(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Nuevo Nombre', price: 9000 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nuevo Nombre');
    expect(res.body.price).toBe(9000);
    expect(res.body.description).toBe('Descripción original'); // no se borró
  });

  it('rechaza con 403 al dueño de OTRO negocio', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const otro = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);

    const res = await request(app)
      .patch(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`)
      .send({ name: 'Robado', price: 1 });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /products/{productId}', () => {
  it('borra el producto de verdad (no es un soft-close como negocios)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);

    const res = await request(app)
      .delete(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query('SELECT 1 FROM productos WHERE id = $1', [producto.id]);
    expect(rows).toHaveLength(0);
  });

  it('rechaza con 403 al dueño de OTRO negocio (el producto no se borra)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const otro = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);

    const res = await request(app)
      .delete(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`);
    expect(res.status).toBe(403);

    const { rows } = await pool.query('SELECT 1 FROM productos WHERE id = $1', [producto.id]);
    expect(rows).toHaveLength(1);
  });
});
