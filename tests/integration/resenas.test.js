const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  REVIEW_REPORT_RATE_LIMIT_MAX,
  REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES,
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

async function aprobar(reviewId) {
  await pool.query("UPDATE resenas SET estado_moderacion = 'aprobada' WHERE id = $1", [reviewId]);
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

describe('POST /businesses/{businessId}/reviews', () => {
  it('crea la reseña en estado pending (201)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 4, comment: 'Muy bueno' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      businessId: negocio.id,
      userId: consumer.user.id,
      rating: 4,
      comment: 'Muy bueno',
      moderationStatus: 'pending',
    });
  });

  it('rechaza con 403 si el dueño del negocio intenta reseñar su propio negocio', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(403);
  });

  it('rechaza una segunda reseña del mismo usuario para el mismo negocio (409, RF-015)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 4 });

    const res = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 2 });

    expect(res.status).toBe(409);
  });

  it('rechaza sin access token (401)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).post(`/businesses/${negocio.id}/reviews`).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  it('rechaza un rating fuera de rango (422)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 6 });

    expect(res.status).toBe(422);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      .post('/businesses/00000000-0000-0000-0000-000000000000/reviews')
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });
    expect(res.status).toBe(404);
  });
});

describe('GET /businesses/{businessId}/reviews', () => {
  it('es público y solo lista reseñas aprobadas', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });

    const antesDeAprobar = await request(app).get(`/businesses/${negocio.id}/reviews`);
    expect(antesDeAprobar.body.data).toEqual([]);

    await aprobar(review.body.id);

    const despues = await request(app).get(`/businesses/${negocio.id}/reviews`);
    expect(despues.body.data.map((r) => r.id)).toEqual([review.body.id]);
    expect(despues.body.data[0].moderationStatus).toBe('approved');
  });

  it('pagina con cursor (limit=1) sin saltar ni repetir reseñas', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const ids = [];
    for (let i = 0; i < 3; i++) {
      const consumer = await registrar('consumer');
      const review = await request(app)
        .post(`/businesses/${negocio.id}/reviews`)
        .set('Authorization', `Bearer ${consumer.accessToken}`)
        .send({ rating: 5 });
      await aprobar(review.body.id);
      ids.push(review.body.id);
    }

    const vistos = [];
    let cursor;
    for (let i = 0; i < 3; i++) {
      const url = cursor
        ? `/businesses/${negocio.id}/reviews?limit=1&cursor=${encodeURIComponent(cursor)}`
        : `/businesses/${negocio.id}/reviews?limit=1`;
      const res = await request(app).get(url);
      expect(res.body.data).toHaveLength(1);
      vistos.push(res.body.data[0].id);
      cursor = res.body.pagination.nextCursor;
    }
    expect(vistos.sort()).toEqual([...ids].sort());
  });

  it('rechaza un cursor corrupto (422, no 500)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).get(
      `/businesses/${negocio.id}/reviews?cursor=esto-no-es-un-cursor`,
    );
    expect(res.status).toBe(422);
  });

  it('responde 404 con un negocio inexistente', async () => {
    const res = await request(app).get('/businesses/00000000-0000-0000-0000-000000000000/reviews');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /reviews/{reviewId}', () => {
  it('permite al autor borrar su propia reseña (204)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });

    const res = await request(app)
      .delete(`/reviews/${review.body.id}`)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query('SELECT 1 FROM resenas WHERE id = $1', [review.body.id]);
    expect(rows).toHaveLength(0);
  });

  it('rechaza con 403 a quien no es el autor (la reseña no se borra)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const otro = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });

    const res = await request(app)
      .delete(`/reviews/${review.body.id}`)
      .set('Authorization', `Bearer ${otro.accessToken}`);
    expect(res.status).toBe(403);

    const { rows } = await pool.query('SELECT 1 FROM resenas WHERE id = $1', [review.body.id]);
    expect(rows).toHaveLength(1);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).delete('/reviews/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });
});

describe('POST /reviews/{reviewId}/report', () => {
  it('un reporte exitoso mueve la reseña de aprobada a pending de inmediato (RF-016)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });
    await aprobar(review.body.id);

    const listaAntes = await request(app).get(`/businesses/${negocio.id}/reviews`);
    expect(listaAntes.body.data).toHaveLength(1);

    const res = await request(app)
      .post(`/reviews/${review.body.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(res.status).toBe(202);

    const { rows } = await pool.query('SELECT estado_moderacion FROM resenas WHERE id = $1', [
      review.body.id,
    ]);
    expect(rows[0].estado_moderacion).toBe('pendiente');

    const listaDespues = await request(app).get(`/businesses/${negocio.id}/reviews`);
    expect(listaDespues.body.data).toEqual([]);
  });

  it('rechaza un segundo reporte del mismo usuario sobre la misma reseña (409, no vuelve a tumbarla)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 5 });

    await request(app)
      .post(`/reviews/${review.body.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    const res = await request(app)
      .post(`/reviews/${review.body.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app).post('/reviews/00000000-0000-0000-0000-000000000000/report');
    expect(res.status).toBe(401);
  });

  it('responde 404 con una reseña inexistente', async () => {
    const reporter = await registrar('consumer');
    const res = await request(app)
      .post('/reviews/00000000-0000-0000-0000-000000000000/report')
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(res.status).toBe(404);
  });

  it(`rechaza con 429 pasado el límite de ${REVIEW_REPORT_RATE_LIMIT_MAX} reportes por ${REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES} min desde el mismo usuario, sobre reseñas distintas`, async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const reviewIds = [];
    for (let i = 0; i <= REVIEW_REPORT_RATE_LIMIT_MAX; i++) {
      const consumer = await registrar('consumer');
      const review = await request(app)
        .post(`/businesses/${negocio.id}/reviews`)
        .set('Authorization', `Bearer ${consumer.accessToken}`)
        .send({ rating: 5 });
      reviewIds.push(review.body.id);
    }

    for (let i = 0; i < REVIEW_REPORT_RATE_LIMIT_MAX; i++) {
      const res = await request(app)
        .post(`/reviews/${reviewIds[i]}/report`)
        .set('Authorization', `Bearer ${reporter.accessToken}`);
      expect(res.status).toBe(202);
    }

    const bloqueado = await request(app)
      .post(`/reviews/${reviewIds[REVIEW_REPORT_RATE_LIMIT_MAX]}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);
    expect(bloqueado.status).toBe(429);
  }, 20000);
});
