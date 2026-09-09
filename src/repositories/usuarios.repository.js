const pool = require('../config/db');

async function crear({ nombreCompleto, correo, contrasenaHash, rol }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombreCompleto, correo, contrasenaHash, rol],
  );
  return rows[0];
}

async function buscarPorCorreo(correo) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function actualizarContrasena(id, contrasenaHash) {
  await pool.query(
    `UPDATE usuarios
     SET contrasena_hash = $2, fecha_actualizacion = now()
     WHERE id = $1`,
    [id, contrasenaHash],
  );
}

/**
 * Endpoint faltante agregado en la Épica 9 (ver CLAUDE.md): "suspender un
 * usuario" es exactamente esto — usuarios.activo ya bloqueaba login()/
 * refresh() desde la Épica 1 (auth.service.js), así que no hace falta
 * ninguna columna ni migración nueva, solo apagar el flag que ya existía.
 * Un access token ya emitido sigue siendo válido hasta su TTL de 15
 * minutos (JWT verificado sin ir a la base de datos) — misma ventana de
 * gracia que Épica 8 documentó para el consentimiento, no un descuido
 * nuevo.
 */
async function suspender(id) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET activo = false, fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

/**
 * GET /admin/metrics y GET /admin/reports/export (RF-021/022): "usuarios
 * registrados" — conteo directo de la tabla, no hay un evento propio para
 * esto (tipo_evento no tiene un valor "registro_usuario", solo
 * 'registro_negocio').
 */
async function contarTotal() {
  const { rows } = await pool.query('SELECT count(*)::int AS total FROM usuarios');
  return rows[0].total;
}

module.exports = {
  crear,
  buscarPorCorreo,
  buscarPorId,
  actualizarContrasena,
  suspender,
  contarTotal,
};
