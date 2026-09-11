const pool = require('../config/db');

async function crear({ negocioId, telefono, codigoHash, expiraEn }) {
  const { rows } = await pool.query(
    `INSERT INTO codigos_verificacion_telefono (negocio_id, telefono, codigo_hash, expira_en)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [negocioId, telefono, codigoHash, expiraEn],
  );
  return rows[0];
}

// Un código nuevo reemplaza al anterior de inmediato — mismo criterio
// que codigosRecuperacion.repository.js#invalidarActivosDeUsuario:
// solo el más reciente debe poder confirmarse.
async function invalidarActivosDelNegocio(negocioId) {
  await pool.query(
    `UPDATE codigos_verificacion_telefono SET invalidado_en = now()
     WHERE negocio_id = $1 AND invalidado_en IS NULL`,
    [negocioId],
  );
}

async function buscarActivoDelNegocio(negocioId) {
  const { rows } = await pool.query(
    `SELECT * FROM codigos_verificacion_telefono
     WHERE negocio_id = $1 AND invalidado_en IS NULL
     ORDER BY creado_en DESC
     LIMIT 1`,
    [negocioId],
  );
  return rows[0] || null;
}

async function incrementarIntentos(id) {
  await pool.query(
    'UPDATE codigos_verificacion_telefono SET intentos = intentos + 1 WHERE id = $1',
    [id],
  );
}

async function invalidar(id) {
  await pool.query('UPDATE codigos_verificacion_telefono SET invalidado_en = now() WHERE id = $1', [
    id,
  ]);
}

/** Base del límite de reenvíos (PHONE_VERIFICATION_RATE_LIMIT_MAX) — por negocio, no por usuario (solo el dueño puede llegar acá de todas formas). */
async function contarRecientesDelNegocio({ negocioId, windowMinutes }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM codigos_verificacion_telefono
     WHERE negocio_id = $1 AND creado_en > now() - ($2 || ' minutes')::interval`,
    [negocioId, windowMinutes],
  );
  return rows[0].total;
}

module.exports = {
  crear,
  invalidarActivosDelNegocio,
  buscarActivoDelNegocio,
  incrementarIntentos,
  invalidar,
  contarRecientesDelNegocio,
};
