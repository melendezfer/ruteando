const crypto = require('node:crypto');
const pool = require('../../src/config/db');
const negociosRepo = require('../../src/repositories/negocios.repository');

// Con pocas filas el planificador de Postgres puede preferir un seq scan
// aunque el índice exista (es más barato para una tabla chiquita) — hace
// falta un volumen representativo para que la prueba demuestre algo real,
// no solo que el índice "existe". Mismo orden de magnitud que se usó para
// verificar esto a mano antes de escribir el código (ver CLAUDE.md).
const VOLUMEN_SEED = 4000;
const CENTRO = { lat: 4.578, lng: -74.217 };

let usuarioId;
let categoriaId;

function recorrerPlan(nodo, visitar) {
  visitar(nodo);
  for (const hijo of nodo.Plans || []) {
    recorrerPlan(hijo, visitar);
  }
}

// Postgres puede resolver "usa el índice" como un "Index Scan" plano o,
// combinado con otros filtros vía bitmap AND, como "Bitmap Index Scan"
// (que alimenta un "Bitmap Heap Scan" para traer las filas) — ambos son
// caminos de acceso por índice, ninguno es un seq scan. Lo único que
// importa para esta prueba es que NINGUNO sea "Seq Scan" y que
// idx_ubicaciones_punto aparezca en alguna variante de Index Scan.
const NODOS_INDEX_SCAN = new Set(['Index Scan', 'Bitmap Index Scan']);

beforeAll(async () => {
  const usuario = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol)
     VALUES ('Seed Explain Plan', $1, 'x', 'vendedor') RETURNING id`,
    [`seed-explain-${crypto.randomUUID()}@ruteando.test`],
  );
  usuarioId = usuario.rows[0].id;

  const categoria = await pool.query(`INSERT INTO categorias (nombre) VALUES ($1) RETURNING id`, [
    `Seed Explain Plan ${crypto.randomUUID()}`,
  ]);
  categoriaId = categoria.rows[0].id;

  await pool.query(
    `INSERT INTO negocios (usuario_id, categoria_id, nombre, estado)
     SELECT $1, $2, 'Negocio Seed ' || g, 'activo'
     FROM generate_series(1, $3) g`,
    [usuarioId, categoriaId, VOLUMEN_SEED],
  );

  await pool.query(
    `INSERT INTO ubicaciones (negocio_id, tipo, punto, es_actual)
     SELECT n.id, 'puesto',
            ST_SetSRID(ST_MakePoint(
              $2 + (random() - 0.5) * 0.3,
              $3 + (random() - 0.5) * 0.3
            ), 4326)::geography,
            true
     FROM negocios n WHERE n.usuario_id = $1`,
    [usuarioId, CENTRO.lng, CENTRO.lat],
  );

  // "Abierto todos los días, todo el día" — para que el filtro openNow de
  // la segunda prueba de abajo matchee prácticamente todo el volumen
  // sembrado (representativo de tráfico real), no cero filas.
  await pool.query(
    `INSERT INTO horarios (negocio_id, dia, hora_apertura, hora_cierre, cerrado)
     SELECT n.id, d.dia, '00:00', '23:59', false
     FROM negocios n, unnest(enum_range(NULL::dia_semana)) AS d(dia)
     WHERE n.usuario_id = $1`,
    [usuarioId],
  );

  // Sin esto, el planificador usa estadísticas viejas/por defecto para
  // las tablas recién sembradas (autoanalyze de Postgres es asíncrono y
  // no alcanza a correr en el tiempo de una prueba) y puede subestimar
  // la selectividad de categoria_id/estado, eligiendo un plan que no
  // pasa por el índice espacial en absoluto — verificado a mano: sin
  // ANALYZE, la segunda prueba de abajo elegía otro camino de acceso.
  await pool.query('ANALYZE negocios, ubicaciones, horarios');
});

afterAll(async () => {
  await pool.query('DELETE FROM negocios WHERE usuario_id = $1', [usuarioId]);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
  await pool.query('DELETE FROM categorias WHERE id = $1', [categoriaId]);
  await pool.end();
});

describe('plan de ejecución de GET /businesses/nearby', () => {
  it('usa el índice GIST idx_ubicaciones_punto y no un seq scan sobre ubicaciones', async () => {
    const plan = await negociosRepo.explicarCercanos({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      radiusKm: 2,
      limit: 20,
    });

    const nodos = [];
    recorrerPlan(plan.Plan, (nodo) => nodos.push(nodo));

    const seqScans = nodos.filter((n) => n['Node Type'] === 'Seq Scan');
    expect(seqScans).toEqual([]);

    const indexScanUbicaciones = nodos.find(
      (n) => NODOS_INDEX_SCAN.has(n['Node Type']) && n['Index Name'] === 'idx_ubicaciones_punto',
    );
    expect(indexScanUbicaciones).toBeDefined();
  });

  it('sigue usando el índice con los filtros combinables activos (categoría + openNow)', async () => {
    const plan = await negociosRepo.explicarCercanos({
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      radiusKm: 2,
      categoryId: categoriaId,
      openNow: true,
      limit: 20,
    });

    const nodos = [];
    recorrerPlan(plan.Plan, (nodo) => nodos.push(nodo));

    expect(nodos.filter((n) => n['Node Type'] === 'Seq Scan')).toEqual([]);
    expect(
      nodos.some(
        (n) => NODOS_INDEX_SCAN.has(n['Node Type']) && n['Index Name'] === 'idx_ubicaciones_punto',
      ),
    ).toBe(true);
  });
});
