const pool = require('../config/db');

/**
 * Fase 1 del panel de administrador (sin RF asociado, ver CLAUDE.md) —
 * `registrar()` es el único punto de escritura, pensado para que las
 * fases 2-5 lo llamen desde sus propios controladores/servicios sin
 * tener que saber nada de la forma de la tabla. `entidadId` se guarda
 * como texto (ver la migración panel-admin-base sobre por qué no puede
 * ser UUID a secas: negocios/usuarios son UUID, tipos_oferta es
 * INTEGER) — String(...) en vez de confiar en que el caller siempre
 * mande un string.
 */
async function registrar({ administradorId, accion, entidadTipo = null, entidadId = null, detalle = null }) {
  const { rows } = await pool.query(
    `INSERT INTO auditoria_admin (administrador_id, accion, entidad_tipo, entidad_id, detalle)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      administradorId,
      accion,
      entidadTipo,
      entidadId != null ? String(entidadId) : null,
      detalle != null ? JSON.stringify(detalle) : null,
    ],
  );
  return rows[0];
}

/**
 * Sin pantalla propia todavía (fases futuras) — existe ya para que la
 * tabla se pueda verificar con una prueba de integración real, no solo
 * confiar en que el INSERT de arriba funciona.
 */
async function listar({ administradorId, entidadTipo, limit = 50 } = {}) {
  const clausulas = [];
  const params = [];

  if (administradorId) {
    params.push(administradorId);
    clausulas.push(`administrador_id = $${params.length}`);
  }
  if (entidadTipo) {
    params.push(entidadTipo);
    clausulas.push(`entidad_tipo = $${params.length}`);
  }

  const where = clausulas.length > 0 ? `WHERE ${clausulas.join(' AND ')}` : '';
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM auditoria_admin ${where} ORDER BY fecha DESC LIMIT $${params.length}`,
    params,
  );
  return rows;
}

module.exports = { registrar, listar };
