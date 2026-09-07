const pool = require('../config/db');

async function crear({ usuarioId, categoriaId, nombre, descripcion, telefonoContacto }) {
  const { rows } = await pool.query(
    `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, telefono_contacto)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [usuarioId, categoriaId, nombre, descripcion ?? null, telefonoContacto ?? null],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM negocios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function actualizar(id, { categoriaId, nombre, descripcion, telefonoContacto }) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET categoria_id = $2, nombre = $3, descripcion = $4, telefono_contacto = $5,
         fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id, categoriaId, nombre, descripcion ?? null, telefonoContacto ?? null],
  );
  return rows[0];
}

async function cerrar(id) {
  const { rows } = await pool.query(
    `UPDATE negocios
     SET estado = 'cerrado', fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

module.exports = { crear, buscarPorId, actualizar, cerrar };
