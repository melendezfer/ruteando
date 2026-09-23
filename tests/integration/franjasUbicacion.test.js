const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { momentoActualBogota } = require('../../src/services/disponibilidad.service');
const { DAY_DB_TO_API } = require('../../src/services/business.mapper');

/**
 * Franjas del día con ubicación propia (migración franjas-ubicacion-ambulante)
 * + modalidad de 3 valores + ícono/color guardados por categoría.
 */
const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

const CENTRO = { lat: 4.6083, lng: -74.2188 };
// ~5.5 km al sur: fuera de un radio de 1 km desde CENTRO.
const LEJOS = { lat: 4.5583, lng: -74.2188 };

const correo = () => `test-${crypto.randomUUID()}@ruteando.test`;

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría franjas ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function registrar() {
  const r = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor', email: correo(), password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(r.body.user.id);
  return r.body.accessToken;
}

async function crearNegocio({ token, categoryId, mobility = 'itinerant', base = LEJOS }) {
  const n = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Tinto ${crypto.randomUUID().slice(0, 6)}`, categoryId, mobility });
  await request(app)
    .put(`/businesses/${n.body.id}/location`)
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'mobile', latitude: base.lat, longitude: base.lng, showExactLocation: true });
  await pool.query("UPDATE negocios SET estado = 'activo', telefono_verificado = true WHERE id = $1", [n.body.id]);
  return n.body.id;
}

// Una franja que cubre "ahora" (todo el día de hoy en Bogotá) y otra en
// un día distinto — sin depender de la hora a la que corra la suite.
function hoyApi() {
  return DAY_DB_TO_API[momentoActualBogota().hoyDb];
}
function otroDiaApi() {
  const dias = Object.values(DAY_DB_TO_API);
  return dias[(dias.indexOf(hoyApi()) + 3) % 7];
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

describe('PUT/GET /businesses/{businessId}/location-slots', () => {
  it('el dueño de un ambulante guarda y lee sus franjas', async () => {
    const token = await registrar();
    const id = await crearNegocio({ token, categoryId: await crearCategoria() });
    const body = [
      { day: 'monday', startTime: '05:00', endTime: '09:00', latitude: 4.6083, longitude: -74.2188, referenceAddress: 'Paradero' },
      { day: 'monday', startTime: '12:00', endTime: '14:00', latitude: 4.61, longitude: -74.22 },
      { day: 'friday', startTime: '22:00', endTime: '02:00', latitude: 4.6, longitude: -74.21 },
    ];
    const put = await request(app).put(`/businesses/${id}/location-slots`).set('Authorization', `Bearer ${token}`).send(body);
    expect(put.status).toBe(200);
    expect(put.body).toHaveLength(3);
    expect(put.body[0]).toMatchObject({ day: 'monday', startTime: '05:00', endTime: '09:00', referenceAddress: 'Paradero' });
    expect(put.body[2]).toMatchObject({ day: 'friday', startTime: '22:00', endTime: '02:00' });

    const get = await request(app).get(`/businesses/${id}/location-slots`);
    expect(get.status).toBe(200);
    expect(get.body).toHaveLength(3);
  });

  it('rechaza sin token (401), a otro usuario (403) y franjas solapadas (422)', async () => {
    const token = await registrar();
    const otro = await registrar();
    const id = await crearNegocio({ token, categoryId: await crearCategoria() });
    const franja = { day: 'monday', startTime: '05:00', endTime: '09:00', latitude: 4.6, longitude: -74.2 };

    expect((await request(app).put(`/businesses/${id}/location-slots`).send([franja])).status).toBe(401);
    expect(
      (await request(app).put(`/businesses/${id}/location-slots`).set('Authorization', `Bearer ${otro}`).send([franja])).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/businesses/${id}/location-slots`)
          .set('Authorization', `Bearer ${token}`)
          .send([franja, { ...franja, startTime: '08:00', endTime: '10:00' }])
      ).status,
    ).toBe(422);
  });

  it('un negocio que no es ambulante no puede declarar franjas (409), pero sí vaciarlas', async () => {
    const token = await registrar();
    const id = await crearNegocio({ token, categoryId: await crearCategoria(), mobility: 'street_stall' });
    const franja = { day: 'monday', startTime: '05:00', endTime: '09:00', latitude: 4.6, longitude: -74.2 };
    const res = await request(app).put(`/businesses/${id}/location-slots`).set('Authorization', `Bearer ${token}`).send([franja]);
    expect(res.status).toBe(409);
    const vacio = await request(app).put(`/businesses/${id}/location-slots`).set('Authorization', `Bearer ${token}`).send([]);
    expect(vacio.status).toBe(200);
  });

  it('el público ve la coordenada de la franja aproximada si el negocio eligió "zona aproximada"', async () => {
    const token = await registrar();
    const id = await crearNegocio({ token, categoryId: await crearCategoria() });
    await request(app).patch(`/businesses/${id}/location/visibility`).set('Authorization', `Bearer ${token}`).send({ showExactLocation: false });
    await request(app)
      .put(`/businesses/${id}/location-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send([{ day: 'monday', startTime: '05:00', endTime: '09:00', latitude: 4.608345, longitude: -74.218812 }]);
    const publico = await request(app).get(`/businesses/${id}/location-slots`);
    expect(publico.body[0].latitude).toBe(4.608);
    const dueno = await request(app).get(`/businesses/${id}/location-slots`).set('Authorization', `Bearer ${token}`);
    expect(dueno.body[0].latitude).toBeCloseTo(4.608345, 6);
  });
});

describe('ubicación efectiva de un ambulante según su franja vigente', () => {
  it('dentro de su franja aparece donde está la franja (nearby, listado y perfil); fuera, en su base', async () => {
    const categoryId = await crearCategoria();
    const token = await registrar();
    const id = await crearNegocio({ token, categoryId, base: LEJOS });

    // Sin franjas: la base está lejos, no aparece cerca de CENTRO.
    const antes = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, radiusKm: 1, categoryId });
    expect(antes.body.data.map((b) => b.id)).not.toContain(id);

    await request(app)
      .put(`/businesses/${id}/location-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { day: hoyApi(), startTime: '00:00', endTime: '23:59', latitude: CENTRO.lat, longitude: CENTRO.lng, referenceAddress: 'Colegio' },
        { day: otroDiaApi(), startTime: '08:00', endTime: '09:00', latitude: LEJOS.lat, longitude: LEJOS.lng },
      ]);

    const cerca = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, radiusKm: 1, categoryId });
    const fila = cerca.body.data.find((b) => b.id === id);
    expect(fila).toBeDefined();
    expect(fila.distanceMeters).toBeLessThan(5);
    expect(fila.latitude).toBeCloseTo(CENTRO.lat, 5);
    expect(fila.activeLocationSlot).toMatchObject({ startTime: '00:00', endTime: '23:59', referenceAddress: 'Colegio' });

    const listado = await request(app).get('/businesses').query({ categoryId });
    expect(listado.body.data.find((b) => b.id === id).latitude).toBeCloseTo(CENTRO.lat, 5);

    const perfil = await request(app).get(`/businesses/${id}`);
    expect(perfil.body.activeLocationSlot).toMatchObject({ referenceAddress: 'Colegio' });
    expect(perfil.body.location.latitude).toBeCloseTo(LEJOS.lat, 5); // `location` sigue siendo la base

    // Cerca de la BASE ya no aparece: ahora mismo está en la franja.
    const cercaBase = await request(app).get('/businesses/nearby').query({ lat: LEJOS.lat, lng: LEJOS.lng, radiusKm: 1, categoryId });
    expect(cercaBase.body.data.map((b) => b.id)).not.toContain(id);
  });

  it('si el negocio deja de ser ambulante, sus franjas guardadas dejan de tener efecto', async () => {
    const categoryId = await crearCategoria();
    const token = await registrar();
    const id = await crearNegocio({ token, categoryId, base: LEJOS });
    await request(app)
      .put(`/businesses/${id}/location-slots`)
      .set('Authorization', `Bearer ${token}`)
      .send([{ day: hoyApi(), startTime: '00:00', endTime: '23:59', latitude: CENTRO.lat, longitude: CENTRO.lng }]);
    await pool.query("UPDATE negocios SET movilidad = 'local_fijo' WHERE id = $1", [id]);

    const cerca = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, radiusKm: 1, categoryId });
    expect(cerca.body.data.map((b) => b.id)).not.toContain(id);
    const perfil = await request(app).get(`/businesses/${id}`);
    expect(perfil.body.activeLocationSlot).toBeNull();
  });
});

describe('modalidad de 3 valores', () => {
  it('acepta street_stall en creación y en PATCH', async () => {
    const token = await registrar();
    const categoryId = await crearCategoria();
    const n = await request(app).post('/businesses').set('Authorization', `Bearer ${token}`).send({ name: 'Puesto', categoryId, mobility: 'street_stall' });
    expect(n.body.mobility).toBe('street_stall');
    const p = await request(app)
      .patch(`/businesses/${n.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Puesto', categoryId, mobility: 'fixed' });
    expect(p.body.mobility).toBe('fixed');
    expect(
      (await request(app).post('/businesses').set('Authorization', `Bearer ${token}`).send({ name: 'X', categoryId, mobility: 'flotante' })).status,
    ).toBe(422);
  });
});

describe('GET /categories — ícono y color guardados', () => {
  it('las categorías reales traen su propio ícono y un color fijo', async () => {
    const res = await request(app).get('/categories');
    const porNombre = Object.fromEntries(res.body.map((c) => [c.name, c]));
    expect(porNombre['Tintos y café']).toMatchObject({ icon: 'coffee', color: '#e8590c', type: 'food' });
    expect(porNombre['Droguerías']).toMatchObject({ icon: 'pill', color: '#9c36b5', type: 'goods' });
    expect(porNombre['Servicios legales básicos']).toMatchObject({ icon: 'scales', color: '#1098ad' });
    // "Postres" es categoría legítima (no un duplicado de "Dulces y postres").
    expect(porNombre['Postres']).toMatchObject({ icon: 'ice-cream', color: '#e8590c', type: 'food' });
    // Ícono propio por categoría: las de comida ya no comparten uno solo.
    const iconosComida = res.body.filter((c) => c.type === 'food' && c.icon).map((c) => c.icon);
    expect(new Set(iconosComida).size).toBe(iconosComida.length);
  });

  it('una categoría sin ícono asignado trae icon null y el gris neutro por defecto', async () => {
    const id = await crearCategoria();
    const res = await request(app).get('/categories');
    expect(res.body.find((c) => c.id === id)).toMatchObject({ icon: null, color: '#6b7280' });
  });
});
