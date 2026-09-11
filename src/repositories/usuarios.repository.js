const pool = require('../config/db');

// contrasena_establecida_en = now(): register() es la vía normal, donde el
// usuario fija su propia contraseña de inmediato — distinto del registro
// asistido (registroAsistido.repository.js), que inserta directo con esta
// columna en NULL a propósito, para que reemitirTokenReclamo() pueda
// distinguir "todavía no reclamó su cuenta" de "ya tiene su propia
// contraseña" (ver migración usuarios-registro-asistido).
//
// ipOrigen: respaldo interno, nunca expuesto en la API (ver
// user.mapper.js, que no lo mapea) ni visible para el propio usuario —
// por si alguna vez hace falta colaborar con una autoridad ante un
// reporte de actividad ilegal (ver CLAUDE.md). Solo se registra acá, en
// register() — el registro asistido (registroAsistido.repository.js) no
// pasa por esta función: la IP de quien hace esa petición es la del
// administrador, no la del vendedor, así que no tendría sentido
// guardarla como "origen" de esa cuenta.
async function crear({ nombreCompleto, correo, contrasenaHash, rol, ipOrigen }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol, contrasena_establecida_en, ip_origen)
     VALUES ($1, $2, $3, $4, now(), $5)
     RETURNING *`,
    [nombreCompleto, correo, contrasenaHash, rol, ipOrigen ?? null],
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

// contrasena_establecida_en = now() acá también: este es el único punto de
// escritura compartido por passwordReset.service.js#restablecerContrasena
// y registroAsistido.service.js#reclamar — cualquiera de los dos caminos
// que termine en "este usuario fijó una contraseña real" debe marcar la
// cuenta como reclamada, o un vendedor que reclamó por la vía de "olvidé
// mi contraseña" (si tenía correo) seguiría viéndose como "sin reclamar"
// para reemitirTokenReclamo().
async function actualizarContrasena(id, contrasenaHash) {
  await pool.query(
    `UPDATE usuarios
     SET contrasena_hash = $2, contrasena_establecida_en = now(), fecha_actualizacion = now()
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
