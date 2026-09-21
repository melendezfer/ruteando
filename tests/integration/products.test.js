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

  it('un PATCH que no manda available NO reactiva un producto marcado como agotado (regresión)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);

    const agotado = await request(app)
      .patch(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: producto.name, price: producto.price, available: false });
    expect(agotado.body.available).toBe(false);

    const soloPrecio = await request(app)
      .patch(`/products/${producto.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: producto.name, price: 9999 });

    expect(soloPrecio.status).toBe(200);
    expect(soloPrecio.body.price).toBe(9999);
    expect(soloPrecio.body.available).toBe(false); // no se reactivó solo
  });
});

// Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
// ver CLAUDE.md, migración productos-tipo-oferta.
describe('Ofertas con vigencia (offerTypeId / validFrom / validUntil)', () => {
  async function obtenerTipoOfertaPorNombre(nombre) {
    const { rows } = await pool.query('SELECT id FROM tipos_oferta WHERE nombre = $1', [nombre]);
    if (!rows[0]) throw new Error(`Tipo de oferta "${nombre}" no encontrado — ¿corrió la migración?`);
    return rows[0].id;
  }

  it('crea un producto con offerTypeId/validFrom/validUntil y los devuelve tal cual', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Promoción');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        name: '2x1 en salchipapas',
        price: 8500,
        offerTypeId,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-01-02T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.offerTypeId).toBe(offerTypeId);
    expect(res.body.validFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(res.body.validUntil).toBe('2026-01-02T00:00:00.000Z');
  });

  it('un producto de catálogo normal deja los tres campos en null', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);
    expect(producto.offerTypeId).toBeNull();
    expect(producto.validFrom).toBeNull();
    expect(producto.validUntil).toBeNull();
  });

  it('rechaza un offerTypeId inexistente (422)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'X', price: 1000, offerTypeId: 999999 });
    expect(res.status).toBe(422);
  });

  it('plan gratis: la segunda oferta con vigencia activa a la vez se rechaza con 409', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    const primera = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 1', price: 10000, offerTypeId, validFrom: new Date().toISOString() });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 2', price: 12000, offerTypeId, validFrom: new Date().toISOString() });
    expect(segunda.status).toBe(409);
  });

  it('plan gratis: una oferta ya vencida no cuenta contra el límite', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    const vencida = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        name: 'Combo vencido',
        price: 10000,
        offerTypeId,
        validFrom: '2020-01-01T00:00:00.000Z',
        validUntil: '2020-01-02T00:00:00.000Z',
      });
    expect(vencida.status).toBe(201);

    const nueva = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo nuevo', price: 12000, offerTypeId, validFrom: new Date().toISOString() });
    expect(nueva.status).toBe(201);
  });

  it('plan gratis: un producto sin vigencia (catálogo normal) no cuenta contra el límite', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    await crearProducto(vendor.accessToken, negocio.id, { name: 'Plato normal' });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo', price: 12000, offerTypeId, validFrom: new Date().toISOString() });
    expect(res.status).toBe(201);
  });

  it('plan pago: sin límite de ofertas con vigencia activa', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    await pool.query("UPDATE negocios SET plan = 'pago' WHERE id = $1", [negocio.id]);
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    const primera = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 1', price: 10000, offerTypeId, validFrom: new Date().toISOString() });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 2', price: 12000, offerTypeId, validFrom: new Date().toISOString() });
    expect(segunda.status).toBe(201);
  });

  it('PATCH que agrega vigencia a un producto existente respeta el límite del plan gratis', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 1', price: 10000, offerTypeId, validFrom: new Date().toISOString() });

    const normal = await crearProducto(vendor.accessToken, negocio.id, { name: 'Plato normal' });

    const res = await request(app)
      .patch(`/products/${normal.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        name: normal.name,
        price: normal.price,
        offerTypeId,
        validFrom: new Date().toISOString(),
      });
    expect(res.status).toBe(409);
  });

  it('PATCH sobre la propia oferta ya activa no choca consigo misma (no se excluye de más ni de menos)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const offerTypeId = await obtenerTipoOfertaPorNombre('Combo');

    const oferta = await request(app)
      .post(`/businesses/${negocio.id}/products`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 1', price: 10000, offerTypeId, validFrom: new Date().toISOString() });

    const res = await request(app)
      .patch(`/products/${oferta.body.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Combo 1 editado', price: 11000 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Combo 1 editado');
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
