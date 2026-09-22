const pool = require('../config/db');

async function crear({ nombreCompleto, correo, contrasenaHash, rol }) {
  const { rows } = await pool.query(
    `INSERT INTO administradores (nombre_completo, correo, contrasena_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombreCompleto, correo, contrasenaHash, rol],
  );
  return rows[0];
}

async function buscarPorCorreo(correo) {
  const { rows } = await pool.query('SELECT * FROM administradores WHERE correo = $1', [correo]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM administradores WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { crear, buscarPorCorreo, buscarPorId };
