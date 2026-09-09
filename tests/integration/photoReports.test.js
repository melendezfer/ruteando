const crypto = require('node:crypto');
const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  PHOTO_REPORT_RATE_LIMIT_MAX,
  PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES,
} = require('../../src/config/constants');

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

async function crearNegocio(vendorToken, categoryId, overrides = {}) {
  const res = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendorToken}`)
    .send({ name: 'Negocio de Prueba', categoryId, ...overrides });
  return res.body;
}

async function jpegDePrueba() {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: 'blue' } })
    .jpeg()
    .toBuffer();
}

async function subirFotoDeNegocio(vendorToken, businessId) {
  const jpeg = await jpegDePrueba();
  const res = await request(app)
    .post(`/businesses/${businessId}/photos`)
    .set('Authorization', `Bearer ${vendorToken}`)
    .attach('file', jpeg, 'foto.jpg');
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

describe('POST /photos/{photoId}/report', () => {
  it('un reporte exitoso mueve la foto de approved a pending y la saca del perfil público', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const foto = await subirFotoDeNegocio(vendor.accessToken, negocio.id);

    const perfilAntes = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfilAntes.body.photos.map((f) => f.id)).toContain(foto.id);

    const res = await request(app)
      .post(`/photos/${foto.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(res.status).toBe(202);

    const { rows } = await pool.query('SELECT estado_moderacion FROM fotos WHERE id = $1', [
      foto.id,
    ]);
    expect(rows[0].estado_moderacion).toBe('pendiente');

    const perfilDespues = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfilDespues.body.photos.map((f) => f.id)).not.toContain(foto.id);
  });

  it('rechaza un segundo reporte del mismo usuario sobre la misma foto (409)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const foto = await subirFotoDeNegocio(vendor.accessToken, negocio.id);

    await request(app)
      .post(`/photos/${foto.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    const res = await request(app)
      .post(`/photos/${foto.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(res.status).toBe(409);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).post('/photos/00000000-0000-0000-0000-000000000000/report');
    expect(res.status).toBe(401);
  });

  it('responde 404 con una foto inexistente', async () => {
    const reporter = await registrar('consumer');
    const res = await request(app)
      .post('/photos/00000000-0000-0000-0000-000000000000/report')
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(res.status).toBe(404);
  });

  it(`rechaza con 429 pasado el límite de ${PHOTO_REPORT_RATE_LIMIT_MAX} reportes por ${PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES} min desde el mismo usuario, sobre fotos distintas`, async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const fotoIds = [];
    for (let i = 0; i <= PHOTO_REPORT_RATE_LIMIT_MAX; i++) {
      const foto = await subirFotoDeNegocio(vendor.accessToken, negocio.id);
      fotoIds.push(foto.id);
    }

    for (let i = 0; i < PHOTO_REPORT_RATE_LIMIT_MAX; i++) {
      const res = await request(app)
        .post(`/photos/${fotoIds[i]}/report`)
        .set('Authorization', `Bearer ${reporter.accessToken}`);
      expect(res.status).toBe(202);
    }

    const bloqueado = await request(app)
      .post(`/photos/${fotoIds[PHOTO_REPORT_RATE_LIMIT_MAX]}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(bloqueado.status).toBe(429);
  }, 20000);
});
