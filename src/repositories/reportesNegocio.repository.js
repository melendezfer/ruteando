const pool = require('../config/db');

async function crear({ negocioId, usuarioId, motivo }) {
  const { rows } = await pool.query(
    `INSERT INTO reportes_negocio (negocio_id, usuario_id, motivo)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [negocioId, usuarioId ?? null, motivo],
  );
  return rows[0];
}

module.exports = { crear };
