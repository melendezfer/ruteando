const pool = require('../config/db');
const { diaAnterior, momentoActualBogota } = require('../services/disponibilidad.service');
const {
  ZONE_RADIUS_METERS,
  ZONE_MIN_BUSINESSES,
  AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES,
} = require('../config/constants');
const env = require('../config/env');

// TEMPORAL, SOLO DESARROLLO — ver CLAUDE.md sección 21 y el comentario
// completo en src/config/env.js. `env.NODE_ENV === 'development'` se
// repite acá aunque env.js ya lo valida al arrancar (su .refine() hace
// fallar el proceso si SKIP_PHONE_VERIFICATION_CHECK='true' fuera de
// development) — defensa en profundidad: este archivo nunca confía en
// que esa variable ya llegó "segura", vuelve a comprobar el ambiente él
// mismo antes de relajar el filtro.
const SALTAR_VERIFICACION_TELEFONO =
  env.NODE_ENV === 'development' && env.SKIP_PHONE_VERIFICATION_CHECK;

/**
 * `listar()`, `construirConsultaCercanos()` y `clusterizar()` comparten
 * este mismo criterio de visibilidad — un solo lugar que decide si la
 * cláusula real de verificación de teléfono aplica o se saltea.
 */
function clausulaTelefonoVerificado() {
  return SALTAR_VERIFICACION_TELEFONO ? 'true' : 'n.telefono_verificado = true';
}

async function crear({
  usuarioId,
  categoriaId,
  nombre,
  descripcion,
  telefonoContacto,
  entregaPropia,
  higieneAutodeclarada,
  movilidad,
}) {
  const { rows } = await pool.query(
    `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, telefono_contacto, entrega_propia, higiene_autodeclarada, movilidad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      usuarioId,
      categoriaId,
      nombre,
      descripcion ?? null,
      telefonoContacto ?? null,
      entregaPropia,
      higieneAutodeclarada,
      movilidad,
    ],
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
async function actualizar(
  id,
  {
    categoriaId,
    nombre,
    descripcion,
    telefonoContacto,
    entregaPropia,
    higieneAutodeclarada,
    movilidad,
  },
) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET categoria_id = $2, nombre = $3, descripcion = $4, telefono_contacto = $5,
         telefono_verificado = (telefono_verificado AND telefono_contacto IS NOT DISTINCT FROM $5::varchar),
         entrega_propia = $6,
         higiene_autodeclarada = $7,
         movilidad = $8,
         fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      categoriaId,
      nombre,
      descripcion ?? null,
      telefonoContacto ?? null,
      entregaPropia,
      higieneAutodeclarada,
      movilidad,
    ],
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
 * LEFT JOIN LATERAL compartido por listar() y cercanos() para traer
 * `disponibilidad_confirmada_en` (Business.availabilityConfirmedAt,
 * sección 11 de CLAUDE.md) — la confirmación "vendiendo ahora" más
 * reciente de cada negocio, solo si sigue fresca. Usa
 * idx_solicitudes_disponibilidad_confirmadas (mismo índice que ya usa
 * solicitudesDisponibilidad.repository.js#obtenerConfirmacionFresca para
 * el perfil individual) — necesario acá también, no solo en el perfil:
 * sin él, esta consulta por negocio terminaría en un seq scan sobre
 * solicitudes_disponibilidad en vez de un index scan a esta escala (ver
 * la prueba de plan de ejecución que lo confirma).
 *
 * `idxFrescura` es el índice ($N) donde el caller ya empujó
 * AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES a `params` — separado de
 * `agregarFiltrosComunes` (que calcula sus propios índices dinámicamente)
 * porque este JOIN va en el FROM, antes que cualquier filtro de WHERE.
 */
function lateralDisponibilidadFresca(idxFrescura) {
  return `LEFT JOIN LATERAL (
       SELECT sd.respondida_en
       FROM solicitudes_disponibilidad sd
       WHERE sd.negocio_id = n.id AND sd.decision = 'confirmada'
         AND sd.respondida_en > now() - ($${idxFrescura} || ' minutes')::interval
       ORDER BY sd.respondida_en DESC
       LIMIT 1
     ) disp ON true`;
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
 *
 * Devuelve `{ idxQ }` — el índice del placeholder de `q` (o `null` si no
 * se buscó por texto) — para que el caller arme
 * `lateralProductosCoincidentes()` reusando exactamente el mismo patrón
 * ya ligado acá, en vez de calcularlo dos veces.
 */
function agregarFiltrosComunes(clausulas, params, { categoryId, q, priceMin, priceMax, openNow }) {
  let idxQ = null;

  if (categoryId != null) {
    params.push(categoryId);
    clausulas.push(`n.categoria_id = $${params.length}`);
  }

  if (q) {
    params.push(`%${escaparComodinesLike(q)}%`);
    idxQ = params.length;
    clausulas.push(
      `(n.nombre ILIKE $${idxQ} OR EXISTS (SELECT 1 FROM productos p WHERE p.negocio_id = n.id AND p.nombre ILIKE $${idxQ}))`,
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

  return { idxQ };
}

/**
 * LEFT JOIN LATERAL compartido por listar() y cercanos() para traer, solo
 * cuando hubo búsqueda de texto (`idxQ` no nulo), el o los productos cuyo
 * nombre coincidió con `q` — mismo patrón `ILIKE $idxQ` ya ligado en
 * agregarFiltrosComunes(), reusado tal cual (no se vuelve a calcular el
 * patrón de comodines escapados). Sin `q`, no arma ningún JOIN — el
 * caller usa `columna: 'NULL'` para esa columna.
 *
 * Sin filtro de `p.disponible` a propósito: la cláusula WHERE de
 * agregarFiltrosComunes() que decide si el negocio aparece TAMPOCO lo
 * filtra — este LATERAL debe devolver exactamente los productos que
 * causaron (o no) que el negocio calificara, no un subconjunto distinto.
 * `json_agg` sobre cero filas da `NULL`, no un array vacío — así el
 * cliente distingue "coincidió por nombre del negocio, ningún producto"
 * (`matchedProducts: null`) de "coincidió por producto" (array con al
 * menos un elemento), sin necesitar un booleano aparte.
 */
function lateralProductosCoincidentes(idxQ) {
  if (idxQ == null) return { join: '', columna: 'NULL' };
  return {
    join: `LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object('nombre', p.nombre, 'precio', p.precio, 'disponible', p.disponible)
         ORDER BY p.nombre
       ) AS productos
       FROM productos p
       WHERE p.negocio_id = n.id AND p.nombre ILIKE $${idxQ}
     ) prodq ON true`,
    columna: 'prodq.productos',
  };
}

/**
 * Columna compartida por listar() y cercanos(): además de qué productos
 * coincidieron (lateralProductosCoincidentes), business.mapper.js#toApiBusiness
 * necesita saber si fue el NOMBRE DEL NEGOCIO el que hizo match, para
 * poder derivar `matchType` (business_name/product/both) sin que el
 * cliente tenga que adivinarlo repitiendo la lógica de ILIKE — regla de
 * seguridad #1, la razón de la coincidencia se decide una sola vez, acá,
 * no en el cliente. Mismo placeholder $idxQ ya ligado en
 * agregarFiltrosComunes(), reusado tal cual. `NULL` (no `false`) cuando
 * no hubo búsqueda de texto — así toApiBusiness distingue "no se buscó
 * por texto" de "se buscó y el nombre no coincidió".
 */
function columnaNombreCoincide(idxQ) {
  return idxQ == null ? 'NULL' : `(n.nombre ILIKE $${idxQ})`;
}

/**
 * GET /users/me/businesses (sin RF asociado — pantalla de inicio por rol,
 * ver CLAUDE.md): los negocios del propio usuario, cualquier estado
 * (a diferencia de listar()/cercanos(), esto NO filtra por
 * `estado = 'activo'` ni por teléfono verificado — es el propio dueño
 * mirando lo suyo, mismo criterio que GET /businesses/{businessId} con
 * el dueño real). Más recientes primero, mismo criterio de orden que
 * listar().
 */
async function listarPorUsuario({ usuarioId, cursor, limit }) {
  const clausulas = ['usuario_id = $1'];
  const params = [usuarioId];

  if (cursor) {
    params.push(cursor.fechaCreacion, cursor.id);
    clausulas.push(
      `(fecha_creacion, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
    );
  }

  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT *, fecha_creacion::text AS fecha_creacion_cursor
     FROM negocios
     WHERE ${clausulas.join(' AND ')}
     ORDER BY fecha_creacion DESC, id DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
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
  // clausulaTelefonoVerificado() la saltea con SKIP_PHONE_VERIFICATION_CHECK
  // (solo development, ver cabecera de este archivo).
  const clausulas = [`n.estado = 'activo'`, clausulaTelefonoVerificado()];
  const params = [AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES];
  const idxFrescura = params.length;

  const { idxQ } = agregarFiltrosComunes(clausulas, params, { categoryId, q, priceMin, priceMax, openNow });
  const productosCoincidentes = lateralProductosCoincidentes(idxQ);

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
    `SELECT n.*, n.fecha_creacion::text AS fecha_creacion_cursor, ub.latitud, ub.longitud, ub.mostrar_ubicacion_exacta,
            disp.respondida_en AS disponibilidad_confirmada_en,
            ${columnaNombreCoincide(idxQ)} AS nombre_coincide,
            ${productosCoincidentes.columna} AS productos_coincidentes
     FROM negocios n
     LEFT JOIN LATERAL (
       SELECT ST_Y(u.punto::geometry) AS latitud, ST_X(u.punto::geometry) AS longitud, u.mostrar_ubicacion_exacta
       FROM ubicaciones u WHERE u.negocio_id = n.id AND u.es_actual = true
       LIMIT 1
     ) ub ON true
     ${lateralDisponibilidadFresca(idxFrescura)}
     ${productosCoincidentes.join}
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
  const clausulas = [`n.estado = 'activo'`, clausulaTelefonoVerificado()];
  const params = [lng, lat]; // $1, $2 — el punto objetivo
  params.push(radiusKm * 1000); // $3 — radio en metros
  clausulas.push(`ST_DWithin(u.punto, objetivo.punto, $3)`);

  params.push(AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES);
  const idxFrescura = params.length; // $4

  const { idxQ } = agregarFiltrosComunes(clausulas, params, {
    categoryId,
    q,
    priceMin,
    priceMax,
    openNow,
  });
  const productosCoincidentes = lateralProductosCoincidentes(idxQ);

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
            u.mostrar_ubicacion_exacta,
            ST_Distance(u.punto, objetivo.punto) AS distancia_m,
            disp.respondida_en AS disponibilidad_confirmada_en,
            ${columnaNombreCoincide(idxQ)} AS nombre_coincide,
            ${productosCoincidentes.columna} AS productos_coincidentes
     FROM negocios n
     JOIN ubicaciones u ON u.negocio_id = n.id AND u.es_actual = true
     CROSS JOIN objetivo
     ${lateralDisponibilidadFresca(idxFrescura)}
     ${productosCoincidentes.join}
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

/**
 * "Zonas de aglomeración" (ver CLAUDE.md sección 32) — agrupa negocios
 * activos y verificados por proximidad real con ST_ClusterDBSCAN
 * (clustering por densidad: eps = radio máximo entre vecinos, minpoints
 * = cuántos negocios mutuamente cercanos hacen falta para formar una
 * zona). Devuelve UNA FILA POR NEGOCIO con el `cluster_id` que le tocó
 * (`null` = "ruido", sin suficientes vecinos cerca para formar zona) —
 * la agregación por zona (conteo, centroide, variedad de categorías) se
 * hace en JS (zonas.service.js#agrupar), no acá: PostGIS ya resolvió la
 * parte cara (clustering espacial sobre un índice GIST); agrupar unas
 * pocas decenas de filas por cluster_id es trivial en JS y mantiene esta
 * consulta legible en vez de anidar dos niveles de agregación en SQL.
 *
 * ST_ClusterDBSCAN exige `geometry`, no `geography`, y su `eps` se mide
 * en las unidades del sistema de coordenadas de esa geometría — en 4326
 * (grados) un eps en metros no significa nada. Se transforma a Web
 * Mercator (SRID 3857, unidades ~metros) solo para el clustering; la
 * distorsión de esa proyección es insignificante a esta escala
 * (agrupaciones de ~200m, cerca del ecuador) — mismo tipo de
 * aproximación plana ya aceptado en
 * scripts/seedDemoBusinesses.js#desplazar ("suficiente a esta escala,
 * <5 km"), no hace falta una zona UTM específica para Cundinamarca.
 * `latitud`/`longitud`/`distancia_m` sí se calculan sobre la geografía
 * real (4326/geography), sin pasar por la proyección — la transformación
 * es solo una herramienta interna para el clustering, nunca lo que se
 * devuelve.
 */
async function clusterizar({ lat, lng, radiusKm }) {
  const { rows } = await pool.query(
    `WITH objetivo AS (
       SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS punto
     )
     SELECT
       n.id AS negocio_id,
       n.categoria_id,
       ST_Y(u.punto::geometry) AS latitud,
       ST_X(u.punto::geometry) AS longitud,
       ST_Distance(u.punto, objetivo.punto) AS distancia_m,
       ST_ClusterDBSCAN(ST_Transform(u.punto::geometry, 3857), $4, $5) OVER () AS cluster_id
     FROM negocios n
     JOIN ubicaciones u ON u.negocio_id = n.id AND u.es_actual = true
     CROSS JOIN objetivo
     WHERE n.estado = 'activo' AND ${clausulaTelefonoVerificado()}
       AND ST_DWithin(u.punto, objetivo.punto, $3)`,
    [lng, lat, radiusKm * 1000, ZONE_RADIUS_METERS, ZONE_MIN_BUSINESSES],
  );
  return rows;
}

module.exports = {
  crear,
  buscarPorId,
  actualizar,
  marcarTelefonoVerificado,
  cerrar,
  listarPorUsuario,
  listar,
  cercanos,
  explicarCercanos,
  clusterizar,
  // Exportada solo para tests unitarios (ver
  // tests/unit/negocios.repository.test.js) — sin esto, probar
  // SKIP_PHONE_VERIFICATION_CHECK exigiría ejecutar una consulta real
  // contra Postgres solo para inspeccionar un fragmento de SQL.
  clausulaTelefonoVerificado,
  escaparComodinesLike,
  listarPendientes,
  aprobar,
  rechazar,
  contarPorEstado,
};
