const pool = require('../config/db');

async function crear({
  negocioId,
  categoriaId,
  nombre,
  descripcion,
  precio,
  disponible,
  tipoOfertaId,
  vigenciaInicio,
  vigenciaFin,
}) {
  const { rows } = await pool.query(
    `INSERT INTO productos
       (negocio_id, categoria_id, nombre, descripcion, precio, disponible,
        tipo_oferta_id, vigencia_inicio, vigencia_fin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      negocioId,
      categoriaId ?? null,
      nombre,
      descripcion ?? null,
      precio,
      disponible,
      tipoOfertaId ?? null,
      vigenciaInicio ?? null,
      vigenciaFin ?? null,
    ],
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listarPorNegocio(negocioId) {
  const { rows } = await pool.query(
    'SELECT * FROM productos WHERE negocio_id = $1 ORDER BY fecha_creacion',
    [negocioId],
  );
  return rows;
}

async function actualizar(
  id,
  {
    categoriaId,
    nombre,
    descripcion,
    precio,
    disponible,
    tipoOfertaId,
    vigenciaInicio,
    vigenciaFin,
  },
) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET categoria_id = $2, nombre = $3, descripcion = $4, precio = $5, disponible = $6,
         tipo_oferta_id = $7, vigencia_inicio = $8, vigencia_fin = $9,
         fecha_actualizacion = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      categoriaId ?? null,
      nombre,
      descripcion ?? null,
      precio,
      disponible,
      tipoOfertaId ?? null,
      vigenciaInicio ?? null,
      vigenciaFin ?? null,
    ],
  );
  return rows[0];
}

async function eliminar(id) {
  await pool.query('DELETE FROM productos WHERE id = $1', [id]);
}

/**
 * Plan gratis: máximo FREE_PLAN_MAX_ACTIVE_OFFERS productos con
 * "vigencia activa" por negocio a la vez (ver
 * productos.service.js#validarLimiteOfertaGratis y la migración
 * productos-tipo-oferta sobre por qué `vigencia_inicio IS NOT NULL`, no
 * `tipo_oferta_id`, es la señal real de "esto es una oferta"). Vigente =
 * `vigencia_fin` nula (sin fecha de cierre) o todavía futura — un
 * producto que YA VENCIÓ libera el cupo aunque nadie lo haya tocado,
 * mismo criterio de expiración perezosa que el resto del proyecto
 * (`solicitudes_disponibilidad`, `codigos_recuperacion`...), sin cron.
 *
 * `excluirProductoId` (al editar una oferta ya existente, para que
 * PATCH sobre la misma oferta no choque contra sí misma).
 */
async function contarOfertasVigentes(negocioId, { excluirProductoId } = {}) {
  const params = [negocioId];
  let clausulaExcluir = '';
  if (excluirProductoId) {
    params.push(excluirProductoId);
    clausulaExcluir = `AND id != $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT count(*)::int AS total
     FROM productos
     WHERE negocio_id = $1
       AND vigencia_inicio IS NOT NULL
       AND (vigencia_fin IS NULL OR vigencia_fin > now())
       ${clausulaExcluir}`,
    params,
  );
  return rows[0].total;
}

module.exports = {
  crear,
  buscarPorId,
  listarPorNegocio,
  actualizar,
  eliminar,
  contarOfertasVigentes,
};
