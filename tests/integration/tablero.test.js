const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { momentoActualBogota } = require('../../src/services/disponibilidad.service');
const estadisticasRepo = require('../../src/repositories/estadisticasNegocio.repository');

/**
 * Perfil 2.0, Etapa 2 — tablero del día (docs/specs/perfil-2.md §4, §7.4,
 * §7.5): GET /businesses/{id}/stats ("Tu semana"),
 * GET /users/me/businesses/today (AHORA / DESPUÉS) y el evento
 * directions_click ("Cómo llegar").
 */
const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];
const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DIA_API = {
  lunes: 'monday',
  martes: 'tuesday',
  miercoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  sabado: 'saturday',
  domingo: 'sunday',
};

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Cat tablero ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function registrar(role = 'vendor') {
  const r = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Persona', email: `test-${crypto.randomUUID()}@ruteando.test`, password: 'password123', role });
  usuarioIdsCreados.push(r.body.user.id);
  return { token: r.body.accessToken, userId: r.body.user.id };
}

/** Negocio del vendedor con un horario dado (lista de ScheduleDay). */
async function crearNegocio(vendor, horario, nombre = `Tablero ${crypto.randomUUID().slice(0, 6)}`) {
  const categoryId = await crearCategoria();
  const n = await request(app)
    .post('/businesses')
    .set('Authorization', `Bearer ${vendor.token}`)
    .send({ name: nombre, categoryId });
  await request(app).put(`/businesses/${n.body.id}/schedule`).set('Authorization', `Bearer ${vendor.token}`).send(horario);
  await pool.query("UPDATE negocios SET estado = 'activo' WHERE id = $1", [n.body.id]);
  return n.body.id;
}

const todoElDia = DIAS.map((day) => ({ day, openTime: '00:00', closeTime: '23:59' }));
const cerradoSiempre = DIAS.map((day) => ({ day, closed: true }));

async function insertarEvento(negocioId, tipo, diasAtras) {
  await pool.query(
    `INSERT INTO eventos (negocio_id, tipo, metadatos, fecha_creacion)
     VALUES ($1, $2, '{"prueba":"tablero"}', now() - make_interval(hours => $3))`,
    [negocioId, tipo, Math.round(diasAtras * 24)],
  );
}

afterAll(async () => {
  await pool.query(`DELETE FROM eventos WHERE metadatos->>'prueba' = 'tablero'`);
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM resenas WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM eventos WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM consentimientos WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  if (categoriaIdsCreadas.length > 0) {
    await pool.query('DELETE FROM categorias WHERE id = ANY($1)', [categoriaIdsCreadas]);
  }
  await pool.end();
});

describe('GET /businesses/{businessId}/stats', () => {
  it('cuenta visitas y contactos (WhatsApp + Cómo llegar) de esta semana y la anterior', async () => {
    const vendor = await registrar();
    const id = await crearNegocio(vendor, todoElDia);
    const otro = await crearNegocio(vendor, todoElDia);
    // Esta semana: 3 visitas, 1 WhatsApp, 2 Cómo llegar.
    for (const d of [0.5, 1, 6]) await insertarEvento(id, 'vista_negocio', d);
    await insertarEvento(id, 'clic_contacto', 2);
    await insertarEvento(id, 'clic_como_llegar', 3);
    await insertarEvento(id, 'clic_como_llegar', 3.5);
    // Semana anterior: 1 visita y 1 WhatsApp. Más atrás: no cuenta.
    await insertarEvento(id, 'vista_negocio', 8);
    await insertarEvento(id, 'clic_contacto', 10);
    await insertarEvento(id, 'vista_negocio', 20);
    // Otro negocio y otros tipos: no cuentan.
    await insertarEvento(otro, 'vista_negocio', 1);
    await insertarEvento(id, 'busqueda', 1);

    const res = await request(app).get(`/businesses/${id}/stats`).set('Authorization', `Bearer ${vendor.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      days: 7,
      current: { profileViews: 3, contacts: 3, averageRating: null, ratingCount: 0 },
      previous: { profileViews: 1, contacts: 1, averageRating: null, ratingCount: 0 },
      pendingReviews: 0,
    });
    // Solo cifras: ningún dato de quién.
    expect(JSON.stringify(res.body)).not.toMatch(/usuario|userId|ip/i);
  });

  it('calificación: solo aprobadas por ventana; pendientes aparte', async () => {
    const vendor = await registrar();
    const id = await crearNegocio(vendor, todoElDia);
    const a = await registrar('consumer');
    const b = await registrar('consumer');
    const c = await registrar('consumer');
    await pool.query(
      `INSERT INTO resenas (negocio_id, usuario_id, calificacion, estado_moderacion, fecha_creacion) VALUES
         ($1, $2, 5, 'aprobada', now() - interval '1 day'),
         ($1, $3, 4, 'aprobada', now() - interval '2 days'),
         ($1, $4, 2, 'pendiente', now() - interval '1 day')`,
      [id, a.userId, b.userId, c.userId],
    );
    const res = await request(app).get(`/businesses/${id}/stats`).set('Authorization', `Bearer ${vendor.token}`);
    expect(res.body.current).toMatchObject({ averageRating: 4.5, ratingCount: 2 });
    expect(res.body.pendingReviews).toBe(1);
  });

  it('401 sin token, 403 a otra persona, 404 negocio inexistente, 422 days fuera de rango', async () => {
    const vendor = await registrar();
    const id = await crearNegocio(vendor, todoElDia);
    const otro = await registrar();
    expect((await request(app).get(`/businesses/${id}/stats`)).status).toBe(401);
    expect((await request(app).get(`/businesses/${id}/stats`).set('Authorization', `Bearer ${otro.token}`)).status).toBe(403);
    expect(
      (await request(app).get(`/businesses/${crypto.randomUUID()}/stats`).set('Authorization', `Bearer ${vendor.token}`)).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/businesses/${id}/stats?days=0`).set('Authorization', `Bearer ${vendor.token}`)).status,
    ).toBe(422);
  });

  it('el conteo de eventos usa idx_eventos_negocio_tipo_fecha (sin recorrer todos los eventos)', async () => {
    const vendor = await registrar();
    const id = await crearNegocio(vendor, todoElDia);
    // Volumen de otros negocios (negocio_id null) para que el índice importe.
    await pool.query(
      `INSERT INTO eventos (negocio_id, tipo, metadatos, fecha_creacion)
       SELECT NULL, 'vista_negocio', '{"prueba":"tablero"}', now() - make_interval(mins => g)
       FROM generate_series(1, 20000) g`,
    );
    for (let i = 0; i < 20; i++) await insertarEvento(id, 'vista_negocio', i / 4);
    await pool.query('ANALYZE eventos');

    const plan = await estadisticasRepo.explicarEventos(id, 7);
    const nodos = [];
    (function recorrer(nodo) {
      nodos.push(nodo);
      for (const hijo of nodo.Plans ?? []) recorrer(hijo);
    })(plan.Plan);
    expect(nodos.filter((n) => n['Node Type'] === 'Seq Scan')).toEqual([]);
    expect(nodos.some((n) => n['Index Name'] === 'idx_eventos_negocio_tipo_fecha')).toBe(true);
  }, 30_000);
});

describe('GET /users/me/businesses/today', () => {
  it('ordena AHORA (con aviso vendiendo primero), DESPUÉS (por hora) y cerrados al final', async () => {
    const vendor = await registrar();
    const { hoyDb, horaActual } = momentoActualBogota();
    const hoy = DIA_API[hoyDb];
    const [h, m] = horaActual.split(':').map(Number);
    const minutos = h * 60 + m;
    const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const cerrado = await crearNegocio(vendor, cerradoSiempre, 'Cerrado hoy');
    const abiertoSinAviso = await crearNegocio(vendor, todoElDia, 'Abierto sin aviso');
    const abiertoConAviso = await crearNegocio(vendor, todoElDia, 'Abierto con aviso');
    await request(app).put(`/businesses/${abiertoConAviso}/selling-now`).set('Authorization', `Bearer ${vendor.token}`);
    // "Más tarde" solo es posible si queda día (antes de las 23:00).
    const quedaDia = minutos < 23 * 60;
    let tarde = null;
    if (quedaDia) {
      tarde = await crearNegocio(
        vendor,
        [{ day: hoy, openTime: hhmm(minutos + 30), closeTime: '23:59' }],
        'Abre más tarde',
      );
    }

    const res = await request(app).get('/users/me/businesses/today').set('Authorization', `Bearer ${vendor.token}`);
    expect(res.status).toBe(200);
    const orden = res.body.data.map((b) => [b.id, b.today.status]);
    const esperado = [
      [abiertoConAviso, 'now'],
      [abiertoSinAviso, 'now'],
      ...(tarde ? [[tarde, 'later']] : []),
      [cerrado, 'closed'],
    ];
    expect(orden).toEqual(esperado);
    if (tarde) {
      expect(res.body.data.find((b) => b.id === tarde).today.openTime).toBe(hhmm(minutos + 30));
    }
    expect(res.body.data[0].availabilityConfirmedAt).not.toBeNull();
  });

  it('no incluye negocios cerrados ni de otra persona; 401 sin token', async () => {
    const vendor = await registrar();
    const propio = await crearNegocio(vendor, todoElDia);
    const cerradoDefinitivo = await crearNegocio(vendor, todoElDia);
    await pool.query("UPDATE negocios SET estado = 'cerrado' WHERE id = $1", [cerradoDefinitivo]);
    const otro = await registrar();
    await crearNegocio(otro, todoElDia);
    const res = await request(app).get('/users/me/businesses/today').set('Authorization', `Bearer ${vendor.token}`);
    expect(res.body.data.map((b) => b.id)).toEqual([propio]);
    expect((await request(app).get('/users/me/businesses/today')).status).toBe(401);
  });
});

describe('POST /events — directions_click', () => {
  it('registra "Cómo llegar" como clic_como_llegar', async () => {
    const vendor = await registrar();
    const id = await crearNegocio(vendor, todoElDia);
    const res = await request(app).post('/events').send({ type: 'directions_click', businessId: id });
    expect(res.status).toBe(202);
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM eventos WHERE negocio_id = $1 AND tipo = 'clic_como_llegar'",
      [id],
    );
    expect(rows[0].n).toBe(1);
  });
});
