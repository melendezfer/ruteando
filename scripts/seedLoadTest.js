#!/usr/bin/env node
/**
 * Siembra un volumen representativo de negocios/ubicaciones/horarios
 * dispersos en Ciudad Verde, Soacha, para correr la prueba de carga de
 * GET /businesses/nearby (scripts/loadtest-nearby.js) contra algo que se
 * parezca a producción — no la base de desarrollo casi vacía.
 *
 * Todas las filas quedan marcadas bajo un mismo correo de "dueño"
 * sintético (SEED_OWNER_EMAIL) para poder limpiarlas con
 * `node scripts/seedLoadTest.js --clean` sin tocar datos reales.
 *
 * Uso:
 *   NODE_ENV=development node scripts/seedLoadTest.js [--count=5000] [--clean]
 */
require('../src/config/env');
const pool = require('../src/config/db');

const SEED_OWNER_EMAIL = 'seed-loadtest-owner@ruteando.test';
const SEED_CATEGORY_NAME = 'Seed Load Test';

// Caja de Ciudad Verde, Soacha (mismo centro que CUNDINAMARCA_BBOX en
// business.validators.js, pero acotado a un radio realista de reparto de
// vendedores informales, no todo el departamento).
const CENTRO = { lat: 4.578, lng: -74.217 };
const DISPERSION_GRADOS = 0.15; // ~15 km de lado

async function limpiar() {
  const usuario = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [SEED_OWNER_EMAIL]);
  if (usuario.rows.length > 0) {
    await pool.query('DELETE FROM negocios WHERE usuario_id = $1', [usuario.rows[0].id]);
    await pool.query('DELETE FROM usuarios WHERE id = $1', [usuario.rows[0].id]);
  }
  await pool.query('DELETE FROM categorias WHERE nombre = $1', [SEED_CATEGORY_NAME]);
  console.log('Datos de prueba de carga eliminados.');
}

async function sembrar(count) {
  const usuario = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol)
     VALUES ('Seed Load Test Owner', $1, 'x', 'vendedor')
     ON CONFLICT (correo) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
     RETURNING id`,
    [SEED_OWNER_EMAIL],
  );
  const usuarioId = usuario.rows[0].id;

  const categoria = await pool.query(
    `INSERT INTO categorias (nombre) VALUES ($1)
     ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [SEED_CATEGORY_NAME],
  );
  const categoriaId = categoria.rows[0].id;

  console.log(`Sembrando ${count} negocios activos...`);
  await pool.query(
    `INSERT INTO negocios (usuario_id, categoria_id, nombre, estado)
     SELECT $1, $2, 'Vendedor Seed ' || g, 'activo'
     FROM generate_series(1, $3) g`,
    [usuarioId, categoriaId, count],
  );

  console.log('Sembrando ubicaciones dispersas en Ciudad Verde...');
  await pool.query(
    `INSERT INTO ubicaciones (negocio_id, tipo, punto, es_actual)
     SELECT n.id, 'puesto',
            ST_SetSRID(ST_MakePoint(
              $2 + (random() - 0.5) * $4,
              $3 + (random() - 0.5) * $4
            ), 4326)::geography,
            true
     FROM negocios n WHERE n.usuario_id = $1`,
    [usuarioId, CENTRO.lng, CENTRO.lat, DISPERSION_GRADOS],
  );

  console.log('Sembrando productos (para ejercitar el filtro de precio)...');
  await pool.query(
    `INSERT INTO productos (negocio_id, nombre, precio, disponible)
     SELECT n.id, 'Producto Seed', (500 + random() * 30000)::numeric(10,2), true
     FROM negocios n WHERE n.usuario_id = $1`,
    [usuarioId],
  );

  console.log('Sembrando horarios (~70% "abierto ahora", para ejercitar ese filtro)...');
  await pool.query(
    `INSERT INTO horarios (negocio_id, dia, hora_apertura, hora_cierre, cerrado)
     SELECT n.id, d.dia,
            CASE WHEN random() < 0.7 THEN '00:00'::time ELSE '10:00'::time END,
            CASE WHEN random() < 0.7 THEN '23:59'::time ELSE '11:00'::time END,
            false
     FROM negocios n, unnest(enum_range(NULL::dia_semana)) AS d(dia)
     WHERE n.usuario_id = $1`,
    [usuarioId],
  );

  console.log('Actualizando estadísticas (ANALYZE) para que el planificador las use...');
  await pool.query('ANALYZE negocios, ubicaciones, productos, horarios');

  console.log(`Listo: ${count} negocios sembrados alrededor de (${CENTRO.lat}, ${CENTRO.lng}).`);
}

async function main() {
  const args = process.argv.slice(2);
  const limpiarSolo = args.includes('--clean');
  const countArg = args.find((a) => a.startsWith('--count='));
  const count = countArg ? Number(countArg.split('=')[1]) : 5000;

  if (limpiarSolo) {
    await limpiar();
  } else {
    await limpiar(); // idempotente: nunca duplica si se corre dos veces
    await sembrar(count);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
