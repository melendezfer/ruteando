const pool = require('../config/db');

// Mismo patrón exacto que tokensRefresco.repository.js (usuarios) —
// tabla separada porque el FK apunta a `administradores`, no a
// `usuarios` (ver migración panel-admin-base).

async function crear({ administradorId, tokenHash, expiraEn }) {
  const { rows } = await pool.query(
    `INSERT INTO tokens_refresco_administrador (administrador_id, token_hash, expira_en)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [administradorId, tokenHash, expiraEn],
  );
  return rows[0];
}

async function buscarPorHash(tokenHash) {
  const { rows } = await pool.query(
    'SELECT * FROM tokens_refresco_administrador WHERE token_hash = $1',
    [tokenHash],
  );
  return rows[0] || null;
}

async function marcarRevocado(id, reemplazadoPorId = null) {
  await pool.query(
    `UPDATE tokens_refresco_administrador
     SET revocado_en = now(), reemplazado_por = $2
     WHERE id = $1`,
    [id, reemplazadoPorId],
  );
}

async function revocarTodosDeAdministrador(administradorId) {
  await pool.query(
    `UPDATE tokens_refresco_administrador
     SET revocado_en = now()
     WHERE administrador_id = $1 AND revocado_en IS NULL`,
    [administradorId],
  );
}

module.exports = { crear, buscarPorHash, marcarRevocado, revocarTodosDeAdministrador };
