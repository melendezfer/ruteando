const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

const usuarioIdsCreados = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(role = 'consumer') {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Usuario de Prueba', email, password: 'password123', role });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query(
      'DELETE FROM solicitudes_eliminacion_cuenta WHERE usuario_id = ANY($1)',
      [usuarioIdsCreados],
    );
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /users/me/account-deletion-request', () => {
  it('crea la solicitud con motivo y comentario (201), sin borrar la cuenta', async () => {
    const usuario = await registrar();

    const res = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ reason: 'technical_problem', comment: 'La app se cerraba sola al buscar' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      userId: usuario.user.id,
      reason: 'technical_problem',
      comment: 'La app se cerraba sola al buscar',
      attendedAt: null,
    });
    expect(res.body.createdAt).toBeTruthy();

    // La cuenta sigue existiendo y activa — la solicitud no la borra.
    const me = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${usuario.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.active).toBe(true);
  });

  it('body vacío es válido — motivo y comentario son completamente opcionales', async () => {
    const usuario = await registrar();

    const res = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.reason).toBeNull();
    expect(res.body.comment).toBeNull();
  });

  it('sin ningún body (Content-Length 0) también es válido', async () => {
    const usuario = await registrar();

    const res = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body.reason).toBeNull();
  });

  it('es idempotente: una segunda solicitud mientras la primera sigue activa devuelve la misma, sin crear otra', async () => {
    const usuario = await registrar();

    const primera = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ reason: 'no_longer_needed' });

    const segunda = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ reason: 'other', comment: 'cambié de opinión sobre el motivo' });

    expect(segunda.status).toBe(201);
    expect(segunda.body.id).toBe(primera.body.id);
    // La segunda llamada no sobrescribe el motivo de la primera — se
    // devuelve la solicitud activa tal cual, no se actualiza.
    expect(segunda.body.reason).toBe('no_longer_needed');

    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM solicitudes_eliminacion_cuenta WHERE usuario_id = $1',
      [usuario.user.id],
    );
    expect(rows[0].total).toBe(1);
  });

  it('rechaza un motivo fuera de las 4 opciones fijas (422)', async () => {
    const usuario = await registrar();

    const res = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ reason: 'me_aburri' });

    expect(res.status).toBe(422);
  });

  it('rechaza sin token (401)', async () => {
    const res = await request(app).post('/users/me/account-deletion-request').send({});
    expect(res.status).toBe(401);
  });

  it('el motivo/comentario sobreviven con userId null si la cuenta se borra de verdad (ON DELETE SET NULL)', async () => {
    const usuario = await registrar();
    const solicitud = await request(app)
      .post('/users/me/account-deletion-request')
      .set('Authorization', `Bearer ${usuario.accessToken}`)
      .send({ reason: 'could_not_find_what_i_needed', comment: 'no encontré comida vegana cerca' });

    // Simula el borrado real de la cuenta (todavía no implementado como
    // endpoint — ver CLAUDE.md) para confirmar que la fila de
    // retroalimentación sí sobrevive, desacoplada del usuario.
    await pool.query('DELETE FROM usuarios WHERE id = $1', [usuario.user.id]);
    usuarioIdsCreados.splice(usuarioIdsCreados.indexOf(usuario.user.id), 1);

    const { rows } = await pool.query(
      'SELECT usuario_id, motivo, comentario FROM solicitudes_eliminacion_cuenta WHERE id = $1',
      [solicitud.body.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].usuario_id).toBeNull();
    expect(rows[0].motivo).toBe('no_encontre_lo_que_buscaba');
    expect(rows[0].comentario).toBe('no encontré comida vegana cerca');

    await pool.query('DELETE FROM solicitudes_eliminacion_cuenta WHERE id = $1', [solicitud.body.id]);
  });
});
