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

async function registrar(role) {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Usuario de Prueba', email, password: 'password123', role });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

async function crearNegocio(accessToken, categoryId, overrides = {}) {
  const res = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Negocio de Prueba', categoryId, ...overrides });
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

describe('POST /businesses', () => {
  it('crea el negocio en estado pending cuando lo hace un vendor (201)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');

    const res = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Salchipapas Doña Ana', categoryId, contactPhone: '3001112233' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ownerId: vendor.user.id,
      categoryId,
      name: 'Salchipapas Doña Ana',
      status: 'pending',
      contactPhone: '3001112233',
    });
  });

  it('rechaza con 403 cuando lo intenta un consumer', async () => {
    const categoryId = await crearCategoria();
    const consumer = await registrar('consumer');

    const res = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${consumer.accessToken}`)
      .send({ name: 'Negocio Ilegal', categoryId });

    expect(res.status).toBe(403);
  });

  it('rechaza sin access token (401)', async () => {
    const categoryId = await crearCategoria();
    const res = await request(app).post('/businesses').send({ name: 'X', categoryId });
    expect(res.status).toBe(401);
  });

  it('rechaza un categoryId que no existe (422)', async () => {
    const vendor = await registrar('vendor');
    const res = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'X', categoryId: 32000 }); // dentro del rango de smallint, pero no existe
    expect(res.status).toBe(422);
  });

  it('rechaza un body sin name (422)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const res = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ categoryId });
    expect(res.status).toBe(422);
  });
});

describe('GET /businesses/{businessId}', () => {
  it('es público y devuelve el negocio aunque esté pending', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).get(`/businesses/${negocio.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(negocio.id);
  });

  it('responde 404 con un UUID válido pero inexistente', async () => {
    const res = await request(app).get('/businesses/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('responde 404 (no 500) con un id mal formado', async () => {
    const res = await request(app).get('/businesses/esto-no-es-un-uuid');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /businesses/{businessId}', () => {
  it('permite editar al propietario y conserva campos no enviados (parche parcial real)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId, {
      contactPhone: '3009998877',
    });

    const res = await request(app)
      .patch(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ name: 'Nuevo Nombre', categoryId });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nuevo Nombre');
    expect(res.body.contactPhone).toBe('3009998877'); // no se borró
  });

  it('rechaza con 403 al dueño de OTRO negocio (no solo a un vendor sin negocio propio)', async () => {
    const categoryId = await crearCategoria();
    const propietarioA = await registrar('vendor');
    const propietarioB = await registrar('vendor');
    const negocioDeA = await crearNegocio(propietarioA.accessToken, categoryId);
    await crearNegocio(propietarioB.accessToken, categoryId); // B es dueño de su propio negocio

    const res = await request(app)
      .patch(`/businesses/${negocioDeA.id}`)
      .set('Authorization', `Bearer ${propietarioB.accessToken}`)
      .send({ name: 'Robado', categoryId });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /businesses/{businessId}', () => {
  it('da de baja el negocio (estado=closed) sin borrar la fila', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .delete(`/businesses/${negocio.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query('SELECT estado FROM negocios WHERE id = $1', [negocio.id]);
    expect(rows[0].estado).toBe('cerrado');
  });

  it('rechaza con 403 al dueño de OTRO negocio (no solo a un vendor sin negocio propio)', async () => {
    const categoryId = await crearCategoria();
    const propietarioA = await registrar('vendor');
    const propietarioB = await registrar('vendor');
    const negocioDeA = await crearNegocio(propietarioA.accessToken, categoryId);
    await crearNegocio(propietarioB.accessToken, categoryId);

    const res = await request(app)
      .delete(`/businesses/${negocioDeA.id}`)
      .set('Authorization', `Bearer ${propietarioB.accessToken}`);
    expect(res.status).toBe(403);

    const { rows } = await pool.query('SELECT estado FROM negocios WHERE id = $1', [
      negocioDeA.id,
    ]);
    expect(rows[0].estado).not.toBe('cerrado'); // el negocio de A sigue intacto
  });
});

describe('GET/PUT /businesses/{businessId}/location', () => {
  it('GET responde 404 antes de que se configure una ubicación', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).get(`/businesses/${negocio.id}/location`);
    expect(res.status).toBe(404);
  });

  it('rechaza coordenadas fuera de Cundinamarca (422)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ type: 'fixed', latitude: 40.7128, longitude: -74.006 });

    expect(res.status).toBe(422);
  });

  it('PUT válido, luego GET público lo devuelve', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const put = await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        type: 'stall',
        referenceAddress: 'Frente al parque',
        latitude: 4.5789,
        longitude: -74.217,
      });
    expect(put.status).toBe(200);
    expect(put.body.isCurrent).toBe(true);

    const get = await request(app).get(`/businesses/${negocio.id}/location`);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ type: 'stall', latitude: 4.5789, longitude: -74.217 });
  });

  it('rotar la ubicación conserva historial pero solo una fila queda es_actual (isCurrent)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ type: 'stall', latitude: 4.5789, longitude: -74.217 });

    await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ type: 'mobile', latitude: 4.58, longitude: -74.22 });

    const { rows } = await pool.query(
      'SELECT tipo, es_actual FROM ubicaciones WHERE negocio_id = $1 ORDER BY fecha_creacion',
      [negocio.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].es_actual).toBe(false);
    expect(rows[1].es_actual).toBe(true);
  });

  it('rechaza con 403 a quien no es el dueño', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const otro = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .put(`/businesses/${negocio.id}/location`)
      .set('Authorization', `Bearer ${otro.accessToken}`)
      .send({ type: 'fixed', latitude: 4.6, longitude: -74.2 });

    expect(res.status).toBe(403);
  });
});

describe('GET/PUT /businesses/{businessId}/schedule', () => {
  it('GET responde 200 con un arreglo vacío antes de configurarse', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app).get(`/businesses/${negocio.id}/schedule`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rechaza un día abierto sin horas (422)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send([{ day: 'monday', closed: false }]);

    expect(res.status).toBe(422);
  });

  it('PUT válido, y GET lo devuelve en orden lunes->domingo sin importar el orden de entrada', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const put = await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send([
        { day: 'sunday', closed: true },
        { day: 'monday', openTime: '08:00', closeTime: '18:00' },
      ]);
    expect(put.status).toBe(200);

    const get = await request(app).get(`/businesses/${negocio.id}/schedule`);
    expect(get.body).toEqual([
      { day: 'monday', openTime: '08:00', closeTime: '18:00', closed: false },
      { day: 'sunday', openTime: null, closeTime: null, closed: true },
    ]);
  });

  it('un segundo PUT reemplaza el horario por completo (los días que ya no vienen desaparecen)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send([{ day: 'monday', openTime: '08:00', closeTime: '18:00' }]);

    const segundo = await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send([{ day: 'friday', openTime: '09:00', closeTime: '17:00' }]);

    expect(segundo.body).toEqual([
      { day: 'friday', openTime: '09:00', closeTime: '17:00', closed: false },
    ]);
  });

  it('rechaza con 403 a quien no es el dueño', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const otro = await registrar('vendor');
    const negocio = await crearNegocio(vendor.accessToken, categoryId);

    const res = await request(app)
      .put(`/businesses/${negocio.id}/schedule`)
      .set('Authorization', `Bearer ${otro.accessToken}`)
      .send([{ day: 'monday', closed: true }]);

    expect(res.status).toBe(403);
  });
});
