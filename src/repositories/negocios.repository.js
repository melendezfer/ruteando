const pool = require('../config/db');
const { diaAnterior, momentoActualBogota } = require('../services/disponibilidad.service');

async function crear({ usuarioId, categoriaId, nombre, descripcion, telefonoContacto }) {
  const { rows } = await pool.query(
    `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, telefono_contacto)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [usuarioId, categoriaId, nombre, descripcion ?? null, telefonoContacto ?? null],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM negocios WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * telefono_verificado se recalcula en la misma consulta (no en
 * negocios.service.js aparte): solo se conserva si el negocio ya estaba
 * verificado Y el teléfono entrante es exactamente el mismo que ya tenía
 * — verificar el número A nunca debe dejar "verificado" un número B
 * nuevo. IS NOT DISTINCT FROM (no `=`) para que pasar de NULL a un
 * número real (o de un número a NULL) también cuente como "cambió", sin
 * el caso especial que `=` tendría con NULL.
 */
async function actualizar(id, { categoriaId, nombre, descripcion, telefonoContacto }) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET categoria_id = $2, nombre = $3, descripcion = $4, telefono_contacto = $5,
         telefono_verificado = (telefono_verificado AND telefono_contacto IS NOT DISTINCT FROM $5::varchar),
         fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id, categoriaId, nombre, descripcion ?? null, telefonoContacto ?? null],
  );
  return rows[0];
}

/** POST /businesses/{businessId}/phone-verification/confirm, tras validar el código — ver verificacionTelefono.service.js. */
async function marcarTelefonoVerificado(id) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET telefono_verificado = true, fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

async function cerrar(id) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET estado = 'cerrado', fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

/**
 * GET /admin/businesses/pending (RF-019): cola de moderación, FIFO (más
 * antiguo primero) — a diferencia de listar()/cercanos() (más reciente
 * primero, para navegación pública), acá importa atender lo que lleva más
 * tiempo esperando. Paginación keyset con el mismo criterio del resto del
 * proyecto (fecha_creacion::text sin pasar por JS Date, ver
 * negocios.service.js#listar).
 */
async function listarPendientes({ cursor, limit }) {
  const clausulas = [`estado = 'pendiente'`];
  const params = [];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT *, fecha_creacion::text AS fecha_creacion_cursor
     FROM negocios
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/**
 * RF-019/020: aprobar()/rechazar() no filtran por estado en el UPDATE — el
 * chequeo de "solo se puede actuar sobre un negocio pendiente" vive en
 * negocios.service.js (fetch -> validar estado -> mutar), mismo patrón que
 * el resto del proyecto (ej. actualizar()/cerrar() con verificarPropietario
 * antes). motivoRechazo queda null en aprobar() a propósito, por si un
 * negocio rechazado antes se vuelve a poner en pendiente y se aprueba
 * después (no hay ruta para eso hoy, pero no tendría sentido dejar un
 * motivo de rechazo viejo colgando en un negocio ya aprobado).
 */
async function aprobar(id) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET estado = 'activo', motivo_rechazo = NULL, fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

async function rechazar(id, motivoRechazo) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET estado = 'rechazado', motivo_rechazo = $2, fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id, motivoRechazo ?? null],
  );
  return rows[0];
}

/**
 * GET /admin/metrics y GET /admin/reports/export (RF-021/022): conteo por
 * estado en una sola consulta agregada, no un COUNT(*) separado por cada
 * estado.
 */
async function contarPorEstado() {
  const { rows } = await pool.query(
    'SELECT estado, count(*)::int AS total FROM negocios GROUP BY estado',
  );
  return Object.fromEntries(rows.map((r) => [r.estado, r.total]));
}

/**
 * ILIKE trata "%" y "_" como comodines incluso viniendo de un parámetro
 * ligado (eso nunca fue una inyección SQL — el patrón sigue siendo un
 * valor, no texto de la consulta — pero sin esto un nombre real que
 * contenga "%" o "_" generaría coincidencias más amplias de lo esperado,
 * o alguien podría mandar "q=%" para matchear todos los negocios). "\" es
 * el carácter de escape por defecto de LIKE/ILIKE en Postgres, así que
 * hay que escapar también un "\" literal del texto de búsqueda antes que
 * nada (si no, un "\" del usuario se leería como el inicio de una
 * secuencia de escape).
 */
function escaparComodinesLike(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Filtros combinables compartidos por listar() y cercanos() (RF-010/011):
 * categoría, texto libre (nombre del negocio o de alguno de sus
 * productos), rango de precio (existe al menos un producto disponible en
 * ese rango) y "abierto ahora". Muta `clausulas`/`params` en vez de
 * devolver un fragmento aparte porque el número de placeholder ($N) de
 * cada filtro depende de cuántos parámetros ya lleva acumulados la
 * consulta que llama (distintos entre listar() y cercanos()) — usar
 * `params.length` como siguiente índice evita tener que llevar la cuenta
 * a mano en cada caller.
 */
function agregarFiltrosComunes(clausulas, params, { categoryId, q, priceMin, priceMax, openNow }) {
  if (categoryId != null) {
    params.push(categoryId);
    clausulas.push(`n.categoria_id = $${params.length}`);
  }

  if (q) {
    params.push(`%${escaparComodinesLike(q)}%`);
    const idx = params.length;
    clausulas.push(
      `(n.nombre ILIKE $${idx} OR EXISTS (SELECT 1 FROM productos p WHERE p.negocio_id = n.id AND p.nombre ILIKE $${idx}))`,
    );
  }

  if (priceMin != null || priceMax != null) {
    const condiciones = ['p.negocio_id = n.id', 'p.disponible'];
    if (priceMin != null) {
      params.push(priceMin);
      condiciones.push(`p.precio >= $${params.length}`);
    }
    if (priceMax != null) {
      params.push(priceMax);
      condiciones.push(`p.precio <= $${params.length}`);
    }
    clausulas.push(`EXISTS (SELECT 1 FROM productos p WHERE ${condiciones.join(' AND ')})`);
  }

  if (openNow) {
    // Misma regla que disponibilidad.service.js#estaAbiertoAhora, en SQL:
    // un turno nocturno (hora_apertura > hora_cierre) queda guardado bajo
    // el día en que empieza, así que hace falta revisar también la fila
    // de "ayer" para la mitad del turno que cae después de medianoche.
    const { hoyDb, horaActual } = momentoActualBogota();
    const ayerDb = diaAnterior(hoyDb);
    params.push(hoyDb, ayerDb, horaActual);
    const [pHoy, pAyer, pAhora] = [params.length - 2, params.length - 1, params.length];
    clausulas.push(`EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.negocio_id = n.id AND h.cerrado = false AND (
           (h.dia = $${pHoy}::dia_semana  AND h.hora_apertura <= h.hora_cierre AND $${pAhora}::time BETWEEN h.hora_apertura AND h.hora_cierre)
        OR (h.dia = $${pHoy}::dia_semana  AND h.hora_apertura >  h.hora_cierre AND $${pAhora}::time >= h.hora_apertura)
        OR (h.dia = $${pAyer}::dia_semana AND h.hora_apertura >  h.hora_cierre AND $${pAhora}::time <= h.hora_cierre)
      )
    )`);
  }
}

/**
 * GET /businesses (RF-010/011): listado con filtros, sin coordenada de
 * referencia. Orden por fecha de creación descendente (más recientes
 * primero) con `id` como desempate — paginación keyset, no OFFSET (ver
 * src/utils/cursor.js).
 */
async function listar({ categoryId, q, priceMin, priceMax, openNow, cursor, limit }) {
  // telefono_verificado = true: verificación de teléfono de vendedores
  // (ver CLAUDE.md) — un negocio 'activo' (aprobado por un administrador)
  // igual no aparece en búsquedas públicas hasta que su dueño verifique
  // el teléfono de contacto por SMS. GET /businesses/{businessId} (perfil
  // por id directo) NO tiene este filtro a propósito: ahí es donde el
  // propio dueño ve el estado "pendiente de verificación" de su negocio.
  const clausulas = [`n.estado = 'activo'`, `n.telefono_verificado = true`];
  const params = [];

  agregarFiltrosComunes(clausulas, params, { categoryId, q, priceMin, priceMax, openNow });

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(n.fecha_creacion, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1); // uno de más, para saber si hay una página siguiente
  const { rows } = await pool.query(
    // n.fecha_creacion::text (aparte de n.*) es lo que arma el cursor en
    // negocios.service.js#listar — node-postgres parsea timestamptz a un
    // JS Date, que solo guarda milisegundos; TIMESTAMPTZ en Postgres
    // guarda microsegundos. Sin este texto aparte, dos negocios creados
    // en el mismo milisegundo (carga masiva, sembrado, ráfaga de
    // registros concurrentes) podían quedar fuera de cualquier página al
    // paginar, porque el cursor comparaba contra un valor ya truncado.
    `SELECT n.*, n.fecha_creacion::text AS fecha_creacion_cursor, ub.latitud, ub.longitud
     FROM negocios n
     LEFT JOIN LATERAL (
       SELECT ST_Y(u.punto::geometry) AS latitud, ST_X(u.punto::geometry) AS longitud
       FROM ubicaciones u WHERE u.negocio_id = n.id AND u.es_actual = true
       LIMIT 1
     ) ub ON true
     WHERE ${clausulas.join(' AND ')}
     ORDER BY n.fecha_creacion DESC, n.id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/**
 * GET /businesses/nearby (RF-009, con los mismos filtros combinables de
 * listar() encima — RF-010/011). ST_DWithin + el operador KNN "<->" usan
 * el índice GIST idx_ubicaciones_punto tanto para el filtro de radio como
 * para el orden por distancia (ver EXPLAIN ANALYZE verificado y la
 * prueba de integración que lo asegura permanentemente).
 */
/**
 * Arma el texto SQL y los params de cercanos() sin ejecutarlo — lo usan
 * tanto cercanos() como explicarCercanos() (esta última, wrappeando el
 * mismo texto en EXPLAIN, es lo que prueba en integración que la consulta
 * real de producción sigue usando idx_ubicaciones_punto y no un seq scan;
 * si se duplicara el SQL en el test, un cambio futuro a este archivo
 * podría dejar de usar el índice sin que la prueba lo note).
 */
function construirConsultaCercanos({
  lat,
  lng,
  radiusKm,
  categoryId,
  q,
  priceMin,
  priceMax,
  openNow,
  cursor,
  limit,
}) {
  // Ver el comentario equivalente en listar() sobre telefono_verificado.
  const clausulas = [`n.estado = 'activo'`, `n.telefono_verificado = true`];
  const params = [lng, lat]; // $1, $2 — el punto objetivo
  params.push(radiusKm * 1000); // $3 — radio en metros
  clausulas.push(`ST_DWithin(u.punto, objetivo.punto, $3)`);

  agregarFiltrosComunes(clausulas, params, { categoryId, q, priceMin, priceMax, openNow });

  if (cursor) {
    params.push(cursor.distanceMeters, cursor.id);
    clausulas.push(
      `(ST_Distance(u.punto, objetivo.punto), n.id) > ($${params.length - 1}::double precision, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const sql = `WITH objetivo AS (
       SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS punto
     )
     SELECT n.*,
            ST_Y(u.punto::geometry) AS latitud,
            ST_X(u.punto::geometry) AS longitud,
            ST_Distance(u.punto, objetivo.punto) AS distancia_m
     FROM negocios n
     JOIN ubicaciones u ON u.negocio_id = n.id AND u.es_actual = true
     CROSS JOIN objetivo
     WHERE ${clausulas.join(' AND ')}
     ORDER BY u.punto <-> objetivo.punto, n.id
     LIMIT $${params.length}`;

  return { sql, params };
}

async function cercanos(filtros) {
  const { sql, params } = construirConsultaCercanos(filtros);
  const { rows } = await pool.query(sql, params);
  return rows;
}

/**
 * Para la prueba de integración que verifica el plan de ejecución (ver
 * tests/integration/nearbyIndexPlan.test.js) — devuelve el plan de
 * EXPLAIN como objeto, sin ejecutar de verdad la consulta subyacente
 * (ANALYZE sí la ejecuta, pero solo para medir; el resultado no se usa).
 */
async function explicarCercanos(filtros) {
  const { sql, params } = construirConsultaCercanos(filtros);
  const { rows } = await pool.query(`EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) ${sql}`, params);
  return rows[0]['QUERY PLAN'][0];
}

module.exports = {
  crear,
  buscarPorId,
  actualizar,
  marcarTelefonoVerificado,
  cerrar,
  listar,
  cercanos,
  explicarCercanos,
  escaparComodinesLike,
  listarPendientes,
  aprobar,
  rechazar,
  contarPorEstado,
};
