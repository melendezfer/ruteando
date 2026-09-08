const crypto = require('node:crypto');
const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { PHOTO_MAX_SIZE_BYTES } = require('../../src/config/constants');

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

async function crearProducto(accessToken, businessId) {
  const res = await request(app)
    .post(`/businesses/${businessId}/products`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Salchipapa', price: 8500 });
  return res.body;
}

async function jpegDePrueba() {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: 'blue' } })
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

describe('POST /businesses/{businessId}/photos', () => {
  it('sube la foto contra el almacenamiento real y la guarda (201)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ businessId: negocio.id, productId: null, type: 'business' });
    expect(res.body.url).toMatch(/^https?:\/\//);

    const { rows } = await pool.query('SELECT * FROM fotos WHERE id = $1', [res.body.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo).toBe('negocio');
  });

  it('rechaza con 403 a quien no es el dueño', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const otro = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    expect(res.status).toBe(403);
  });

  it('rechaza sin access token (401)', async () => {
    const { negocio } = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .attach('file', jpeg, 'foto.jpg');

    expect(res.status).toBe(401);
  });

  it('rechaza un archivo que no es una imagen real, aunque venga con extensión/mimetype de imagen (422)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const noEsImagen = Buffer.from('esto no es una imagen, son bytes cualquiera');

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', noEsImagen, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
  });

  it('rechaza un tipo de archivo no permitido (422)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 no es una imagen'), {
        filename: 'archivo.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(422);
  });

  it('rechaza un archivo más grande que PHOTO_MAX_SIZE_BYTES (422)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const archivoGrande = Buffer.alloc(PHOTO_MAX_SIZE_BYTES + 1024, 1);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', archivoGrande, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
  }, 15000);
});

describe('POST /products/{productId}/photos', () => {
  it('sube la foto cuando lo hace el dueño del negocio dueño del producto (201)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);
    const jpeg = await jpegDePrueba();

    const res = await request(app)
      .post(`/products/${producto.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      businessId: null,
      productId: producto.id,
      type: 'product',
    });
  });

  it('rechaza con 403 a quien no es el dueño del negocio del producto', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);
    const otro = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();

    const res = await request(app)
      .post(`/products/${producto.id}/photos`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    expect(res.status).toBe(403);
  });
});

describe('DELETE /photos/{photoId}', () => {
  it('borra una foto de negocio, incluyendo el objeto remoto (204)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();
    const subida = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    const res = await request(app)
      .delete(`/photos/${subida.body.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query('SELECT 1 FROM fotos WHERE id = $1', [subida.body.id]);
    expect(rows).toHaveLength(0);
  });

  it('borra una foto de producto resolviendo el dueño a través del negocio (204)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const producto = await crearProducto(vendor.accessToken, negocio.id);
    const jpeg = await jpegDePrueba();
    const subida = await request(app)
      .post(`/products/${producto.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    const res = await request(app)
      .delete(`/photos/${subida.body.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(204);
  });

  it('rechaza con 403 a quien no es el dueño (la foto no se borra)', async () => {
    const { vendor, negocio } = await registrarVendedorConNegocio();
    const otro = await registrarVendedorConNegocio();
    const jpeg = await jpegDePrueba();
    const subida = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    const res = await request(app)
      .delete(`/photos/${subida.body.id}`)
      .set('Authorization', `Bearer ${otro.vendor.accessToken}`);
    expect(res.status).toBe(403);

    const { rows } = await pool.query('SELECT 1 FROM fotos WHERE id = $1', [subida.body.id]);
    expect(rows).toHaveLength(1);
  });

  it('responde 404 con un id inexistente', async () => {
    const { vendor } = await registrarVendedorConNegocio();
    const res = await request(app)
      .delete('/photos/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(404);
  });
});
