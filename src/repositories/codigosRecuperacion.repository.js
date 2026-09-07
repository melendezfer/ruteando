const pool = require('../config/db');

async function invalidarActivosDeUsuario(usuarioId) {
  await pool.query(
    `UPDATE codigos_recuperacion
     SET invalidado_en = now()
     WHERE usuario_id = $1 AND invalidado_en IS NULL`,
    [usuarioId],
  );
}

async function crear({ usuarioId, codigoHash, expiraEn }) {
  const { rows } = await pool.query(
    `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [usuarioId, codigoHash, expiraEn],
  );
  return rows[0];
}

async function buscarPorHash(codigoHash) {
  const { rows } = await pool.query('SELECT * FROM codigos_recuperacion WHERE codigo_hash = $1', [
    codigoHash,
  ]);
  return rows[0] || null;
}

async function marcarInvalidado(id) {
  await pool.query('UPDATE codigos_recuperacion SET invalidado_en = now() WHERE id = $1', [id]);
}

module.exports = { invalidarActivosDeUsuario, crear, buscarPorHash, marcarInvalidado };
