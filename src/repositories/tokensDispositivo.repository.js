const pool = require('../config/db');

/**
 * ON CONFLICT (token): un token FCM identifica una instalación de la app
 * en un dispositivo, no una cuenta — si el mismo dispositivo cierra sesión
 * y entra con otra cuenta, el token se reasigna al nuevo usuario_id en vez
 * de chocar contra el UNIQUE.
 */
async function registrar({ usuarioId, token }) {
  const { rows } = await pool.query(
    `INSERT INTO tokens_dispositivo (usuario_id, token)
     VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, fecha_actualizacion = now()
     RETURNING *`,
    [usuarioId, token],
  );
  return rows[0];
}

async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query('SELECT * FROM tokens_dispositivo WHERE usuario_id = $1', [
    usuarioId,
  ]);
  return rows;
}

module.exports = { registrar, listarPorUsuario };
