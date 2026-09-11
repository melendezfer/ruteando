const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const cursorUtil = require('../../src/utils/cursor');

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

// telefono_verificado = true: desde la verificación de teléfono de
// vendedores (ver CLAUDE.md), un negocio 'activo' sin el teléfono
// verificado tampoco aparece en /businesses ni /businesses/nearby — esta
// suite prueba el descubrimiento, no ese flujo aparte, así que se activa
// directo por SQL igual que el estado.
async function activar(negocioId) {
  await pool.query(
    "UPDATE negocios SET estado = 'activo', telefono_verificado = true WHERE id = $1",
    [negocioId],
  );
}

/**
 * Crea un negocio ya activo, con ubicación, listo para aparecer en
 * búsquedas — no existe todavía el endpoint de aprobación (Épica 9), así
 * que se activa directo en la base de datos, igual que en el resto de la
 * suite de negocios.
 */
async function crearNegocioActivo({ categoryId, lat, lng, name = 'Negocio de Prueba' } = {}) {
  const email = correoDePrueba();
  const registro = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor', email, password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(registro.body.user.id);
  const accessToken = registro.body.accessToken;

  const catId = categoryId ?? (await crearCategoria());
  const negocio = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name, categoryId: catId });

  if (lat != null && lng != null) {
    // showExactLocation: true — esta suite prueba búsqueda/distancia, no
    // la aproximación de "zona aproximada" (eso vive en
    // businesses.test.js); sin esto, el default (false) redondearía las
    // coordenadas devueltas y podría desalinear aserciones de distancia
    // exacta en pruebas que no tienen nada que ver con esa funcionalidad.
    await request(app)
      .put(`/businesses/${negocio.body.id}/location`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'stall', latitude: lat, longitude: lng, showExactLocation: true });
  }

  await activar(negocio.body.id);

  return { id: negocio.body.id, accessToken, categoryId: catId };
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

describe('GET /categories', () => {
  it('es público y devuelve las categorías ordenadas', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /businesses/nearby', () => {
  const CENTRO = { lat: 4.578, lng: -74.217 };

  it('requiere lat y lng (422 sin ellos)', async () => {
    const res = await request(app).get('/businesses/nearby');
    expect(res.status).toBe(422);
  });

  it('rechaza coordenadas fuera de Cundinamarca (422)', async () => {
    const res = await request(app).get('/businesses/nearby?lat=40.7128&lng=-74.006');
    expect(res.status).toBe(422);
  });

  it('devuelve solo negocios activos, ordenados por distancia ascendente', async () => {
    const cerca = await crearNegocioActivo({
      lat: CENTRO.lat + 0.001,
      lng: CENTRO.lng,
      name: 'Cerca',
    });
    await crearNegocioActivo({ lat: CENTRO.lat + 0.02, lng: CENTRO.lng, name: 'Lejos' });
    // Pendiente (nunca activado) — no debe aparecer aunque esté dentro del radio.
    const email = correoDePrueba();
    const registro = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Vendedor Pendiente', email, password: 'password123', role: 'vendor' });
    usuarioIdsCreados.push(registro.body.user.id);
    const pendiente = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ name: 'Pendiente', categoryId: cerca.categoryId });
    await request(app)
      .put(`/businesses/${pendiente.body.id}/location`)
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ type: 'stall', latitude: CENTRO.lat, longitude: CENTRO.lng });

    const res = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5`,
    );

    expect(res.status).toBe(200);
    const nombres = res.body.data.map((b) => b.name);
    expect(nombres).toContain('Cerca');
    expect(nombres).toContain('Lejos');
    expect(nombres).not.toContain('Pendiente');
    expect(nombres.indexOf('Cerca')).toBeLessThan(nombres.indexOf('Lejos'));

    const cercaItem = res.body.data.find((b) => b.name === 'Cerca');
    expect(cercaItem.distanceMeters).toBeGreaterThan(0);
    expect(cercaItem.latitude).toBeCloseTo(CENTRO.lat + 0.001, 3);
    expect(cercaItem.longitude).toBeCloseTo(CENTRO.lng, 3);
  });

  it('no devuelve negocios fuera del radio pedido', async () => {
    const categoryId = await crearCategoria();
    await crearNegocioActivo({ lat: CENTRO.lat, lng: CENTRO.lng, categoryId, name: 'Adentro' });
    await crearNegocioActivo({
      lat: CENTRO.lat + 1,
      lng: CENTRO.lng,
      categoryId,
      name: 'MuyLejos',
    });

    const res = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=2&categoryId=${categoryId}`,
    );

    const nombres = res.body.data.map((b) => b.name);
    expect(nombres).toContain('Adentro');
    expect(nombres).not.toContain('MuyLejos');
  });

  it('filtra por rango de precio (existe al menos un producto disponible en el rango)', async () => {
    const categoryId = await crearCategoria();
    const barato = await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Barato',
    });
    const caro = await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Caro',
    });

    await request(app)
      .post(`/businesses/${barato.id}/products`)
      .set('Authorization', `Bearer ${barato.accessToken}`)
      .send({ name: 'Producto barato', price: 3000 });
    await request(app)
      .post(`/businesses/${caro.id}/products`)
      .set('Authorization', `Bearer ${caro.accessToken}`)
      .send({ name: 'Producto caro', price: 50000 });

    const res = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5&categoryId=${categoryId}&priceMin=1000&priceMax=5000`,
    );

    const nombres = res.body.data.map((b) => b.name);
    expect(nombres).toContain('Barato');
    expect(nombres).not.toContain('Caro');
  });

  it('filtra por texto libre sobre el nombre del negocio o de un producto', async () => {
    const categoryId = await crearCategoria();
    const conProducto = await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Puesto Genérico',
    });
    await crearNegocioActivo({ lat: CENTRO.lat, lng: CENTRO.lng, categoryId, name: 'Otro Puesto' });

    await request(app)
      .post(`/businesses/${conProducto.id}/products`)
      .set('Authorization', `Bearer ${conProducto.accessToken}`)
      .send({ name: 'Arepa de Choclo', price: 4000 });

    const res = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5&categoryId=${categoryId}&q=choclo`,
    );

    const nombres = res.body.data.map((b) => b.name);
    expect(nombres).toEqual(['Puesto Genérico']);
  });

  it('los comodines de LIKE ("%", "_") en q se tratan como texto literal, no como comodines (regresión)', async () => {
    const categoryId = await crearCategoria();
    await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Descuento 50% Hoy',
    });
    await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Otro Negocio Sin Comodines',
    });

    // Si "%" no se escapara, "q=%" matchearía CUALQUIER nombre (comodín
    // de "cualquier texto"), no solo el que de verdad tiene un "%".
    const conComodin = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5&categoryId=${categoryId}&q=${encodeURIComponent('50%')}`,
    );
    expect(conComodin.body.data.map((b) => b.name)).toEqual(['Descuento 50% Hoy']);

    // "q=%" solo (sin más texto) no debe traer TODOS los negocios de la
    // categoría — debe buscar un "%" literal, que ninguno de los dos tiene
    // por sí solo salvo el de arriba.
    const soloComodin = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5&categoryId=${categoryId}&q=${encodeURIComponent('%')}`,
    );
    expect(soloComodin.body.data.map((b) => b.name)).toEqual(['Descuento 50% Hoy']);
  });

  it('paginación keyset: con un empate exacto de distancia, ninguno de los dos se salta ni se repite', async () => {
    const categoryId = await crearCategoria();
    const a = await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Empate A',
    });
    const b = await crearNegocioActivo({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      categoryId,
      name: 'Empate B',
    });

    const pagina1 = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=1&categoryId=${categoryId}&limit=1`,
    );
    expect(pagina1.body.data).toHaveLength(1);
    expect(pagina1.body.pagination.hasMore).toBe(true);
    expect(pagina1.body.pagination.nextCursor).not.toBeNull();

    const pagina2 = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=1&categoryId=${categoryId}&limit=1&cursor=${encodeURIComponent(pagina1.body.pagination.nextCursor)}`,
    );
    expect(pagina2.body.data).toHaveLength(1);
    expect(pagina2.body.pagination.hasMore).toBe(false);

    const idsVistos = [pagina1.body.data[0].id, pagina2.body.data[0].id].sort();
    expect(idsVistos).toEqual([a.id, b.id].sort());
  });

  it('rechaza un cursor manipulado/corrupto (422, no un 500)', async () => {
    const res = await request(app).get(
      `/businesses/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&cursor=esto-no-es-un-cursor-valido`,
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /businesses (lista con filtros, sin coordenada)', () => {
  it('es público, solo devuelve activos, y respeta categoryId', async () => {
    const categoryId = await crearCategoria();
    const activo = await crearNegocioActivo({ categoryId, name: 'Activo Lista' });

    const res = await request(app).get(`/businesses?categoryId=${categoryId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.id)).toContain(activo.id);
  });

  it('rechaza priceMin mayor que priceMax (422)', async () => {
    const res = await request(app).get('/businesses?priceMin=100&priceMax=50');
    expect(res.status).toBe(422);
  });

  it('rechaza un cursor con forma válida pero fechaCreacion no parseable (422, no un 500 crudo de Postgres)', async () => {
    const cursor = cursorUtil.codificar({
      fechaCreacion: 'esto-no-es-una-fecha',
      id: '01a07d3e-41f0-70c8-bce2-227eaec1dc10',
    });

    const res = await request(app).get(`/businesses?cursor=${encodeURIComponent(cursor)}`);
    expect(res.status).toBe(422);
  });

  it('paginación keyset: dos negocios creados en el mismo milisegundo (distinta fecha_creacion en microsegundos) no se saltan (regresión: el cursor perdía precisión al pasar por un JS Date)', async () => {
    const categoryId = await crearCategoria();
    const email1 = correoDePrueba();
    const email2 = correoDePrueba();
    const registro1 = await request(app)
      .post('/auth/register')
      .send({ fullName: 'V1', email: email1, password: 'password123', role: 'vendor' });
    const registro2 = await request(app)
      .post('/auth/register')
      .send({ fullName: 'V2', email: email2, password: 'password123', role: 'vendor' });
    usuarioIdsCreados.push(registro1.body.user.id, registro2.body.user.id);

    // Mismo milisegundo, microsegundos distintos — justo el caso que un
    // cursor construido con `new Date(...).toISOString()` (precisión de
    // milisegundos) podía saltarse.
    const negocio1 = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${registro1.body.accessToken}`)
      .send({ name: 'Microsegundo A', categoryId });
    const negocio2 = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${registro2.body.accessToken}`)
      .send({ name: 'Microsegundo B', categoryId });

    await pool.query(
      `UPDATE negocios SET estado = 'activo', telefono_verificado = true, fecha_creacion = $2 WHERE id = $1`,
      [negocio1.body.id, '2026-01-01 00:00:00.123900+00'],
    );
    await pool.query(
      `UPDATE negocios SET estado = 'activo', telefono_verificado = true, fecha_creacion = $2 WHERE id = $1`,
      [negocio2.body.id, '2026-01-01 00:00:00.123100+00'],
    );

    const pagina1 = await request(app).get(`/businesses?categoryId=${categoryId}&limit=1`);
    expect(pagina1.body.data).toHaveLength(1);
    expect(pagina1.body.pagination.hasMore).toBe(true);

    const pagina2 = await request(app).get(
      `/businesses?categoryId=${categoryId}&limit=1&cursor=${encodeURIComponent(pagina1.body.pagination.nextCursor)}`,
    );
    expect(pagina2.body.data).toHaveLength(1);
    expect(pagina2.body.pagination.hasMore).toBe(false);

    const idsVistos = [pagina1.body.data[0].id, pagina2.body.data[0].id].sort();
    expect(idsVistos).toEqual([negocio1.body.id, negocio2.body.id].sort());
  });
});
