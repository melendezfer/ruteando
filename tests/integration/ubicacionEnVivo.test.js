const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

/**
 * Ubicación en vivo del ambulante (migración ubicacion-en-vivo): reglas
 * de escritura, ubicación efectiva, rastro de 15 minutos, apagado manual y
 * automático (fuera de horario / app cerrada).
 */
const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];
const CENTRO = { lat: 4.6083, lng: -74.2188 };
const LEJOS = { lat: 4.5583, lng: -74.2188 };
const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [`Cat vivo ${crypto.randomUUID()}`]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function registrar() {
  const r = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor', email: `test-${crypto.randomUUID()}@ruteando.test`, password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(r.body.user.id);
  return r.body.accessToken;
}

async function consentir(token) {
  return request(app).post('/consents').set('Authorization', `Bearer ${token}`).send({ type: 'live_location', textVersion: '1.0' });
}

/** Ambulante activo, con base LEJOS, abierto todo el día (o cerrado hoy). */
async function crearAmbulante({ mobility = 'itinerant', abierto = true, exacta = false } = {}) {
  const token = await registrar();
  const categoryId = await crearCategoria();
  const n = await request(app).post('/businesses').set('Authorization', `Bearer ${token}`).send({ name: 'Tinto vivo', categoryId, mobility });
  await request(app)
    .put(`/businesses/${n.body.id}/location`)
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'mobile', latitude: LEJOS.lat, longitude: LEJOS.lng, showExactLocation: exacta });
  await request(app)
    .put(`/businesses/${n.body.id}/schedule`)
    .set('Authorization', `Bearer ${token}`)
    .send(DIAS.map((day) => (abierto ? { day, openTime: '00:00', closeTime: '23:59' } : { day, closed: true })));
  await pool.query("UPDATE negocios SET estado = 'activo', telefono_verificado = true WHERE id = $1", [n.body.id]);
  return { id: n.body.id, token, categoryId };
}

const enviar = (id, token, pos = CENTRO) =>
  request(app).post(`/businesses/${id}/live-location`).set('Authorization', `Bearer ${token}`).send({ latitude: pos.lat, longitude: pos.lng });

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM consentimientos WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  if (categoriaIdsCreadas.length > 0) await pool.query('DELETE FROM categorias WHERE id = ANY($1)', [categoriaIdsCreadas]);
  await pool.end();
});

describe('POST /businesses/{businessId}/live-location — reglas', () => {
  it('401 sin token, 403 a otro usuario, 422 fuera de Cundinamarca', async () => {
    const { id } = await crearAmbulante();
    const otro = await registrar();
    expect((await request(app).post(`/businesses/${id}/live-location`).send({ latitude: 4.6, longitude: -74.2 })).status).toBe(401);
    expect((await enviar(id, otro)).status).toBe(403);
    const { token } = await crearAmbulante();
    expect((await enviar(id, token, { lat: 10, lng: -74 })).status).toBe(422);
  });

  it('sin el consentimiento live_location responde 403 consent-required', async () => {
    const { id, token } = await crearAmbulante();
    const res = await enviar(id, token);
    expect(res.status).toBe(403);
    expect(res.body.type).toMatch(/consent-required$/);
    expect(res.body.missingConsentTypes).toEqual(['live_location']);
  });

  it('un negocio que no es ambulante no comparte en vivo (409)', async () => {
    const { id, token } = await crearAmbulante({ mobility: 'street_stall' });
    await consentir(token);
    expect((await enviar(id, token)).status).toBe(409);
  });

  it('fuera de horario responde 409 con type live-location-off-schedule (se apaga sola)', async () => {
    const { id, token } = await crearAmbulante({ abierto: false });
    await consentir(token);
    const res = await enviar(id, token);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/live-location-off-schedule$/);
  });

  it('descarta una posición que llega a menos de 10 s de la anterior', async () => {
    const { id, token } = await crearAmbulante();
    await consentir(token);
    expect((await enviar(id, token)).body).toEqual({ saved: true });
    expect((await enviar(id, token)).body).toEqual({ saved: false });
  });
});

describe('ubicación efectiva y rastro', () => {
  it('en vivo aparece en su posición real (exacta aunque eligió zona aproximada) con el rastro de 15 minutos', async () => {
    const { id, token, categoryId } = await crearAmbulante({ exacta: false });
    await consentir(token);
    // Rastro sembrado: una posición de hace 20 min (fuera de la ventana),
    // dos dentro, y la actual.
    await pool.query(
      `INSERT INTO posiciones_en_vivo (negocio_id, punto, registrada_en) VALUES
         ($1, ST_SetSRID(ST_MakePoint(-74.2188, 4.6000), 4326)::geography, now() - interval '20 minutes'),
         ($1, ST_SetSRID(ST_MakePoint(-74.2188, 4.6050), 4326)::geography, now() - interval '10 minutes'),
         ($1, ST_SetSRID(ST_MakePoint(-74.2188, 4.6070), 4326)::geography, now() - interval '5 minutes')`,
      [id],
    );
    const precisa = { lat: 4.608345, lng: -74.218812 };
    expect((await enviar(id, token, precisa)).body).toEqual({ saved: true });

    // La limpieza perezosa ya borró la de hace 20 min.
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM posiciones_en_vivo WHERE negocio_id = $1', [id]);
    expect(rows[0].n).toBe(3);

    const cerca = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, radiusKm: 1, categoryId });
    const fila = cerca.body.data.find((b) => b.id === id);
    expect(fila).toBeDefined();
    expect(fila.latitude).toBeCloseTo(precisa.lat, 6); // exacta, no redondeada a 3 decimales
    expect(fila.liveLocation.trail).toHaveLength(3);
    expect(fila.liveLocation.trail[0].latitude).toBeCloseTo(4.605, 5); // de la más antigua a la más reciente
    expect(fila.liveLocation.latitude).toBeCloseTo(precisa.lat, 6);

    const perfil = await request(app).get(`/businesses/${id}`);
    expect(perfil.body.liveLocation.trail).toHaveLength(3);
  });

  it('si la app lleva más de 2 minutos sin mandar posición, deja de estar en vivo y vuelve a su base', async () => {
    const { id, token, categoryId } = await crearAmbulante();
    await consentir(token);
    await enviar(id, token);
    await pool.query("UPDATE posiciones_en_vivo SET registrada_en = now() - interval '3 minutes' WHERE negocio_id = $1", [id]);
    const cerca = await request(app).get('/businesses/nearby').query({ lat: CENTRO.lat, lng: CENTRO.lng, radiusKm: 1, categoryId });
    expect(cerca.body.data.map((b) => b.id)).not.toContain(id);
    const lista = await request(app).get('/businesses').query({ categoryId });
    const fila = lista.body.data.find((b) => b.id === id);
    expect(fila.liveLocation).toBeNull();
    expect(fila.latitude).toBeCloseTo(4.558, 3);
  });

  it('DELETE apaga en el acto y borra el rastro', async () => {
    const { id, token } = await crearAmbulante();
    await consentir(token);
    await enviar(id, token);
    expect((await request(app).delete(`/businesses/${id}/live-location`).set('Authorization', `Bearer ${token}`)).status).toBe(204);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM posiciones_en_vivo WHERE negocio_id = $1', [id]);
    expect(rows[0].n).toBe(0);
    expect((await request(app).get(`/businesses/${id}`)).body.liveLocation).toBeNull();
  });
});
