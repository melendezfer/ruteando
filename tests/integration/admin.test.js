const crypto = require('node:crypto');
const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { signAccessToken } = require('../../src/services/token.service');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

function tokenAdmin() {
  // register() bloquea role=administrator (auth.validators.js) — no hay
  // forma de conseguir un admin vía la API pública, así que se firma el
  // JWT directo (mismo mecanismo que usa auth.service.js al hacer login),
  // sin pasar por consentimiento (Épica 8) ni por una fila real en
  // usuarios: authenticate()/requireRole() nunca van a la base de datos.
  return signAccessToken({ id: crypto.randomUUID(), rol: 'administrador' });
}

async function registrar(role, nombre = 'Usuario de Prueba') {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: nombre, email, password: 'password123', role });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría de prueba ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
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

describe('autorización a nivel de función en /admin/*', () => {
  const rutas = [
    ['get', '/admin/businesses/pending'],
    ['patch', '/admin/businesses/00000000-0000-0000-0000-000000000000/approve'],
    ['patch', '/admin/businesses/00000000-0000-0000-0000-000000000000/reject'],
    ['get', '/admin/reviews/reported'],
    ['patch', '/admin/reviews/00000000-0000-0000-0000-000000000000/moderate'],
    ['get', '/admin/photos/reported'],
    ['patch', '/admin/photos/00000000-0000-0000-0000-000000000000/moderate'],
    ['patch', '/admin/users/00000000-0000-0000-0000-000000000000/suspend'],
    ['patch', '/admin/users/00000000-0000-0000-0000-000000000000/reissue-claim-token'],
    ['get', '/admin/outdated-reports'],
    ['patch', '/admin/outdated-reports/00000000-0000-0000-0000-000000000000/resolve'],
    ['get', '/admin/metrics'],
    ['get', '/admin/reports/export'],
  ];

  it.each(rutas)('%s %s rechaza sin token (401)', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  it.each(rutas)('%s %s rechaza con un rol no administrador (403)', async (method, path) => {
    const consumer = await registrar('consumer');
    const res = await request(app)
      [method](path)
      .set('Authorization', `Bearer ${consumer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /admin/businesses/pending + approve/reject (RF-019/020)', () => {
  it('lista solo negocios pendientes, más antiguos primero', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const pendiente = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .get('/admin/businesses/pending')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.id)).toContain(pendiente.id);
    expect(res.body.data.every((b) => b.status === 'pending')).toBe(true);
  });

  it('aprobar mueve el negocio a active y ya no aparece en pending (200)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .patch(`/admin/businesses/${negocio.id}/approve`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const lista = await request(app)
      .get('/admin/businesses/pending')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(lista.body.data.map((b) => b.id)).not.toContain(negocio.id);
  });

  it('aprobar dos veces el mismo negocio responde 409 la segunda vez', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/businesses/${negocio.id}/approve`)
      .set('Authorization', `Bearer ${admin}`);

    const res = await request(app)
      .patch(`/admin/businesses/${negocio.id}/approve`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(409);
  });

  it('aprobar un negocio inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/admin/businesses/00000000-0000-0000-0000-000000000000/approve')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(404);
  });

  it('rechazar guarda el motivo y lo expone en GET /businesses/{businessId} para el dueño (RF-020)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .patch(`/admin/businesses/${negocio.id}/reject`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ reason: 'Falta verificar el teléfono de contacto' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Falta verificar el teléfono de contacto',
    });

    // Autorización a nivel de objeto: solo el dueño autenticado ve el
    // motivo real en el perfil público — cualquier otro caso, null.
    const comoDueño = await request(app)
      .get(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(comoDueño.body.rejectionReason).toBe('Falta verificar el teléfono de contacto');

    const anonimo = await request(app).get(`/businesses/${negocio.id}`);
    expect(anonimo.body.rejectionReason).toBeNull();

    const otroVendor = await registrar('vendor');
    const comoOtro = await request(app)
      .get(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${otroVendor.accessToken}`);
    expect(comoOtro.body.rejectionReason).toBeNull();
  });

  it('rechazar sin reason deja rejectionReason en null (reason es opcional)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .patch(`/admin/businesses/${negocio.id}/reject`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBeNull();
  });

  it('rechazar un negocio que ya no está pendiente responde 409', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/businesses/${negocio.id}/approve`)
      .set('Authorization', `Bearer ${admin}`);

    const res = await request(app)
      .patch(`/admin/businesses/${negocio.id}/reject`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'Ya no aplica' });
    expect(res.status).toBe(409);
  });
});

describe('GET /admin/reviews/reported + moderate (RF-021)', () => {
  async function crearResenaPendiente() {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const consumer = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const review = await request(app)
      .post(`/businesses/${negocio.id}/reviews`)
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ rating: 3 });
    return { negocio, review: review.body };
  }

  it('lista toda reseña pendiente, no solo las reportadas (toda reseña nueva nace pending)', async () => {
    const { review } = await crearResenaPendiente();

    const res = await request(app)
      .get('/admin/reviews/reported')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(review.id);
  });

  it('aprobar hace que la reseña pase a estar visible públicamente (200)', async () => {
    const { negocio, review } = await crearResenaPendiente();

    const res = await request(app)
      .patch(`/admin/reviews/${review.id}/moderate`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.moderationStatus).toBe('approved');

    const publica = await request(app).get(`/businesses/${negocio.id}/reviews`);
    expect(publica.body.data.map((r) => r.id)).toContain(review.id);
  });

  it('rechazar dos veces la misma reseña responde 409 la segunda vez', async () => {
    const { review } = await crearResenaPendiente();
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/reviews/${review.id}/moderate`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'rejected' });

    const res = await request(app)
      .patch(`/admin/reviews/${review.id}/moderate`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'rejected' });
    expect(res.status).toBe(409);
  });

  it('un decision fuera del enum responde 422', async () => {
    const { review } = await crearResenaPendiente();
    const res = await request(app)
      .patch(`/admin/reviews/${review.id}/moderate`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(422);
  });
});

describe('GET /admin/photos/reported + moderate (moderación de fotos, gap de la Épica 6)', () => {
  async function crearFotoReportada() {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const reporter = await registrar('consumer');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const jpeg = await jpegDePrueba();
    const foto = await request(app)
      .post(`/businesses/${negocio.id}/photos`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .attach('file', jpeg, 'foto.jpg');

    await request(app)
      .post(`/photos/${foto.body.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    return { negocio, foto: foto.body };
  }

  it('una foto reportada aparece en la cola de moderación', async () => {
    const { foto } = await crearFotoReportada();

    const res = await request(app)
      .get('/admin/photos/reported')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((f) => f.id)).toContain(foto.id);
  });

  it('aprobar la devuelve al perfil público del negocio (200)', async () => {
    const { negocio, foto } = await crearFotoReportada();

    const res = await request(app)
      .patch(`/admin/photos/${foto.id}/moderate`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.moderationStatus).toBe('approved');

    const perfil = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfil.body.photos.map((f) => f.id)).toContain(foto.id);
  });

  it('rechazarla la deja fuera del perfil público (200)', async () => {
    const { negocio, foto } = await crearFotoReportada();

    await request(app)
      .patch(`/admin/photos/${foto.id}/moderate`)
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ decision: 'rejected' });

    const perfil = await request(app).get(`/businesses/${negocio.id}`);
    expect(perfil.body.photos.map((f) => f.id)).not.toContain(foto.id);
  });

  it('moderar dos veces la misma foto responde 409 la segunda vez', async () => {
    const { foto } = await crearFotoReportada();
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/photos/${foto.id}/moderate`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'approved' });

    const res = await request(app)
      .patch(`/admin/photos/${foto.id}/moderate`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'approved' });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /admin/users/{userId}/suspend', () => {
  it('suspende al usuario y bloquea su siguiente login (200)', async () => {
    const consumer = await registrar('consumer');

    const res = await request(app)
      .patch(`/admin/users/${consumer.user.id}/suspend`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: consumer.user.id, active: false });

    const { rows } = await pool.query('SELECT activo FROM usuarios WHERE id = $1', [
      consumer.user.id,
    ]);
    expect(rows[0].activo).toBe(false);
  });

  it('suspender dos veces al mismo usuario responde 409 la segunda vez', async () => {
    const consumer = await registrar('consumer');
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/users/${consumer.user.id}/suspend`)
      .set('Authorization', `Bearer ${admin}`);

    const res = await request(app)
      .patch(`/admin/users/${consumer.user.id}/suspend`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(409);
  });

  it('suspender un usuario inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/suspend')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/outdated-reports + resolve (RF-025)', () => {
  it('lista solo reportes sin atender y resolve los saca de la lista (200)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const reporte = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .send({ reason: 'Ya no vende en esa ubicación' });

    const antes = await request(app)
      .get('/admin/outdated-reports')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(antes.body.data.map((r) => r.id)).toContain(reporte.body.id);

    const res = await request(app)
      .patch(`/admin/outdated-reports/${reporte.body.id}/resolve`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(200);
    expect(res.body.attendedAt).not.toBeNull();

    const despues = await request(app)
      .get('/admin/outdated-reports')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(despues.body.data.map((r) => r.id)).not.toContain(reporte.body.id);
  });

  it('resolver dos veces el mismo reporte responde 409 la segunda vez', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);
    const reporte = await request(app)
      .post(`/businesses/${negocio.id}/outdated-reports`)
      .send({ reason: 'Motivo' });
    const admin = tokenAdmin();

    await request(app)
      .patch(`/admin/outdated-reports/${reporte.body.id}/resolve`)
      .set('Authorization', `Bearer ${admin}`);

    const res = await request(app)
      .patch(`/admin/outdated-reports/${reporte.body.id}/resolve`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(409);
  });

  it('resolver un reporte inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/admin/outdated-reports/00000000-0000-0000-0000-000000000000/resolve')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/metrics y GET /admin/reports/export (RF-021/022)', () => {
  it('metrics refleja negocios activos/pendientes y usuarios registrados reales', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        activeBusinesses: expect.any(Number),
        pendingBusinesses: expect.any(Number),
        registeredUsers: expect.any(Number),
        searches: expect.any(Number),
        contactClicks: expect.any(Number),
      }),
    );
    expect(res.body.pendingBusinesses).toBeGreaterThanOrEqual(1);
    expect(res.body.registeredUsers).toBeGreaterThanOrEqual(1);
  });

  it('export devuelve metrics + conteos por estado/tipo + colas pendientes', async () => {
    const res = await request(app)
      .get('/admin/reports/export')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        metrics: expect.any(Object),
        businessesByStatus: expect.any(Object),
        eventsByType: expect.any(Object),
        pendingOutdatedReports: expect.any(Array),
        pendingReportedReviews: expect.any(Array),
        pendingReportedPhotos: expect.any(Array),
      }),
    );
  });
});
