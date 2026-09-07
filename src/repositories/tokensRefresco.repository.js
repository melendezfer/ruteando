const pool = require('../config/db');

async function crear({ usuarioId, tokenHash, expiraEn }) {
  const { rows } = await pool.query(
    `INSERT INTO tokens_refresco (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [usuarioId, tokenHash, expiraEn],
  );
  return rows[0];
}

async function buscarPorHash(tokenHash) {
  const { rows } = await pool.query('SELECT * FROM tokens_refresco WHERE token_hash = $1', [
    tokenHash,
  ]);
  return rows[0] || null;
}

async function marcarRevocado(id, reemplazadoPorId = null) {
  await pool.query(
    `UPDATE tokens_refresco
     SET revocado_en = now(), reemplazado_por = $2
     WHERE id = $1`,
    [id, reemplazadoPorId],
  );
}

async function revocarTodosDeUsuario(usuarioId) {
  await pool.query(
    `UPDATE tokens_refresco
     SET revocado_en = now()
     WHERE usuario_id = $1 AND revocado_en IS NULL`,
    [usuarioId],
  );
}

module.exports = { crear, buscarPorHash, marcarRevocado, revocarTodosDeUsuario };
