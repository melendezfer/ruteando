const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-zonas-${crypto.randomUUID()}@ruteando.test`;
}

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría zonas ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

/**
 * Negocio activo, con teléfono verificado y ubicación puntual — mismo
 * patrón que discovery.test.js#crearNegocioActivo, pero siempre con
 * coordenadas (acá el punto exacto es lo único que importa) y
 * `showExactLocation: true` (para no depender de la aproximación de
 * "zona aproximada" al comparar coordenadas).
 */
async function crearNegocioEnPunto({ categoryId, lat, lng }) {
  const email = correoDePrueba();
  const registro = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Vendedor Zonas', email, password: 'password123', role: 'vendor' });
  usuarioIdsCreados.push(registro.body.user.id);
  const accessToken = registro.body.accessToken;

  const negocio = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: `Negocio Zonas ${crypto.randomUUID()}`, categoryId });

  await request(app)
    .put(`/businesses/${negocio.body.id}/location`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ type: 'stall', latitude: lat, longitude: lng, showExactLocation: true });

  await pool.query("UPDATE negocios SET estado = 'activo', telefono_verificado = true WHERE id = $1", [
    negocio.body.id,
  ]);

  return { id: negocio.body.id, accessToken, categoryId };
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

describe('GET /businesses/zones', () => {
  it('requiere lat y lng (422 sin ellos)', async () => {
    const res = await request(app).get('/businesses/zones');
    expect(res.status).toBe(422);
  });

  it('rechaza coordenadas fuera de Cundinamarca (422)', async () => {
    const res = await request(app).get('/businesses/zones?lat=40.7128&lng=-74.006');
    expect(res.status).toBe(422);
  });

  it('agrupa 3+ negocios mutuamente cercanos en una zona con el resumen de variedad correcto, y deja fuera un negocio aislado', async () => {
    const catA = await crearCategoria();
    const catB = await crearCategoria();
    const CENTRO = { lat: 4.65, lng: -74.25 };

    // 3 negocios a ~30-60m entre sí (bien dentro de eps=200m).
    await crearNegocioEnPunto({ categoryId: catA, lat: CENTRO.lat, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catB, lat: CENTRO.lat + 0.0003, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catA, lat: CENTRO.lat - 0.0003, lng: CENTRO.lng });
    // Aislado, ~2km al norte — dentro del radio de búsqueda (radiusKm=5)
    // pero fuera del radio de clustering (eps=200m): no debe sumarse a
    // la zona de arriba ni formar la suya propia (está solo).
    await crearNegocioEnPunto({ categoryId: catA, lat: CENTRO.lat + 0.018, lng: CENTRO.lng });

    const res = await request(app).get(
      `/businesses/zones?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5`,
    );

    expect(res.status).toBe(200);
    // catA/catB son ids frescos (recién insertados) — buscar la zona que
    // contiene ambos identifica sin ambigüedad la de esta prueba, sin
    // importar qué más haya en la base (datos de demo, otras pruebas).
    const zona = res.body.find(
      (z) => z.categories.some((c) => c.categoryId === catA) && z.categories.some((c) => c.categoryId === catB),
    );

    expect(zona).toBeDefined();
    expect(zona.businessCount).toBe(3); // el aislado no se coló
    expect(zona.categoryCount).toBe(2);
    expect(zona.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: catA, count: 2 }),
        expect.objectContaining({ categoryId: catB, count: 1 }),
      ]),
    );
    expect(typeof zona.centerLatitude).toBe('number');
    expect(typeof zona.centerLongitude).toBe('number');
    expect(zona.distanceMeters).toBeGreaterThanOrEqual(0);
  });

  it('no cuenta negocios pendientes ni con teléfono sin verificar para formar una zona (mismo criterio de visibilidad que /businesses y /businesses/nearby)', async () => {
    const cat = await crearCategoria();
    const CENTRO = { lat: 4.66, lng: -74.26 };

    // Solo 2 negocios realmente visibles (activos + teléfono verificado)
    // — por debajo de ZONE_MIN_BUSINESSES (3), no alcanza para formar
    // zona por sí solo.
    await crearNegocioEnPunto({ categoryId: cat, lat: CENTRO.lat, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: cat, lat: CENTRO.lat + 0.0002, lng: CENTRO.lng });

    // Un tercero, mismo punto, pero con el teléfono SIN verificar — si el
    // filtro de visibilidad fallara, completaría el mínimo de 3 y sí
    // formaría zona.
    const email = correoDePrueba();
    const registro = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Vendedor Zonas', email, password: 'password123', role: 'vendor' });
    usuarioIdsCreados.push(registro.body.user.id);
    const negocio = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ name: 'Negocio sin verificar', categoryId: cat });
    await request(app)
      .put(`/businesses/${negocio.body.id}/location`)
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ type: 'stall', latitude: CENTRO.lat - 0.0002, longitude: CENTRO.lng, showExactLocation: true });
    await pool.query("UPDATE negocios SET estado = 'activo', telefono_verificado = false WHERE id = $1", [
      negocio.body.id,
    ]);

    const res = await request(app).get(
      `/businesses/zones?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5`,
    );

    expect(res.status).toBe(200);
    const zona = res.body.find((z) => z.categories.some((c) => c.categoryId === cat));
    expect(zona).toBeUndefined();
  });

  it('ordena las zonas por distancia ascendente al punto de búsqueda', async () => {
    const catCercana = await crearCategoria();
    const catLejana = await crearCategoria();
    const CENTRO = { lat: 4.67, lng: -74.27 };

    // Zona lejana (~1km) — sembrada primero, a propósito, para que el
    // orden del resultado no pueda depender del orden de inserción.
    await crearNegocioEnPunto({ categoryId: catLejana, lat: CENTRO.lat + 0.009, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catLejana, lat: CENTRO.lat + 0.0092, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catLejana, lat: CENTRO.lat + 0.0088, lng: CENTRO.lng });

    // Zona cercana (~30m del punto de búsqueda).
    await crearNegocioEnPunto({ categoryId: catCercana, lat: CENTRO.lat, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catCercana, lat: CENTRO.lat + 0.0003, lng: CENTRO.lng });
    await crearNegocioEnPunto({ categoryId: catCercana, lat: CENTRO.lat - 0.0003, lng: CENTRO.lng });

    const res = await request(app).get(
      `/businesses/zones?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radiusKm=5`,
    );

    expect(res.status).toBe(200);
    const idxCercana = res.body.findIndex((z) => z.categories.some((c) => c.categoryId === catCercana));
    const idxLejana = res.body.findIndex((z) => z.categories.some((c) => c.categoryId === catLejana));
    expect(idxCercana).toBeGreaterThanOrEqual(0);
    expect(idxLejana).toBeGreaterThanOrEqual(0);
    expect(idxCercana).toBeLessThan(idxLejana);
    expect(res.body[idxCercana].distanceMeters).toBeLessThan(res.body[idxLejana].distanceMeters);
  });
});
