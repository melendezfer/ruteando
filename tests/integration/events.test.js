const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { EVENT_RATE_LIMIT_MAX } = require('../../src/config/constants');

const usuarioIdsCreados = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

afterEach(async () => {
  // Los eventos no quedan ligados a un usuario/negocio de prueba que se
  // pueda limpiar por cascada — se borran directo para no contaminar el
  // conteo del límite de abuso entre pruebas (todas comparten la misma
  // IP de supertest).
  await pool.query('DELETE FROM eventos');
});

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /events', () => {
  it('acepta un evento anónimo mínimo (202, sin body)', async () => {
    const res = await request(app).post('/events').send({ type: 'search' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({});
  });

  it('rechaza un type fuera del enum (422)', async () => {
    const res = await request(app).post('/events').send({ type: 'not_a_real_type' });
    expect(res.status).toBe(422);
  });

  it('rechaza un businessId mal formado (422, nunca llega a la base de datos)', async () => {
    const res = await request(app)
      .post('/events')
      .send({ type: 'contact_click', businessId: 'esto-no-es-un-uuid' });
    expect(res.status).toBe(422);
  });

  it('acepta un businessId con formato de UUID válido aunque no exista (202, analítica de mejor esfuerzo)', async () => {
    const res = await request(app)
      .post('/events')
      .send({ type: 'business_view', businessId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      "SELECT negocio_id FROM eventos WHERE tipo = 'vista_negocio' ORDER BY fecha_creacion DESC LIMIT 1",
    );
    expect(rows[0].negocio_id).toBeNull();
  });

  it('rechaza metadata que pesa más del límite (422)', async () => {
    const res = await request(app)
      .post('/events')
      .send({ type: 'search', metadata: { big: 'x'.repeat(3000) } });
    expect(res.status).toBe(422);
  });

  it('con un Bearer válido, el evento queda asociado al usuario; anónimo, no', async () => {
    const email = correoDePrueba();
    const registro = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Usuario Evento', email, password: 'password123', role: 'consumer' });
    usuarioIdsCreados.push(registro.body.user.id);

    await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ type: 'contact_click' });

    const { rows } = await pool.query(
      "SELECT usuario_id, ip_origen FROM eventos WHERE tipo = 'clic_contacto' ORDER BY fecha_creacion DESC LIMIT 1",
    );
    expect(rows[0].usuario_id).toBe(registro.body.user.id);
    expect(rows[0].ip_origen).toBeNull(); // autenticado: no se guarda IP

    await request(app).post('/events').send({ type: 'contact_click' });
    const anonimo = await pool.query(
      "SELECT usuario_id, ip_origen FROM eventos WHERE tipo = 'clic_contacto' ORDER BY fecha_creacion DESC LIMIT 1",
    );
    expect(anonimo.rows[0].usuario_id).toBeNull();
    expect(anonimo.rows[0].ip_origen).not.toBeNull(); // anónimo: sí se guarda IP
  });

  it(`rechaza con 429 pasado el límite de ${EVENT_RATE_LIMIT_MAX} eventos por minuto desde el mismo origen`, async () => {
    for (let i = 0; i < EVENT_RATE_LIMIT_MAX; i++) {
      const res = await request(app).post('/events').send({ type: 'search' });
      expect(res.status).toBe(202);
    }

    const bloqueado = await request(app).post('/events').send({ type: 'search' });
    expect(bloqueado.status).toBe(429);
  }, 20000);
});
