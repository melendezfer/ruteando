const tiposOfertaRepo = require('../repositories/tiposOferta.repository');
const { NotFoundError, ConflictError } = require('../errors');

// Código de Postgres para unique_violation — lo lanza el UNIQUE(nombre)
// de tipos_oferta (mismo criterio que resenas.service.js/fotos.service.js).
const PG_UNIQUE_VIOLATION = '23505';

function toApiOfferType(row) {
  return {
    id: row.id,
    name: row.nombre,
    icon: row.icono,
    displayOrder: row.orden_visualizacion,
    active: row.activo,
  };
}

/** GET /offer-types (público) — solo los activos, ver el repositorio. */
async function listarActivos() {
  const tipos = await tiposOfertaRepo.listarActivos();
  return tipos.map(toApiOfferType);
}

/** GET /admin/offer-types — el equipo administrador ve también los inactivos. */
async function listarTodos() {
  const tipos = await tiposOfertaRepo.listarTodos();
  return tipos.map(toApiOfferType);
}

async function obtenerCrudoOFallar(id) {
  const tipo = await tiposOfertaRepo.buscarPorId(id);
  if (!tipo) {
    throw new NotFoundError('Tipo de oferta no encontrado');
  }
  return tipo;
}

/**
 * POST /admin/offer-types — sin límite de cuántos tipos puede haber (el
 * catálogo es corto por diseño, 4 sembrados de fábrica, ver la migración
 * tipos-oferta) pero nada impide que el equipo administrador agregue más
 * si hace falta.
 */
async function crear(input) {
  try {
    const tipo = await tiposOfertaRepo.crear({
      nombre: input.name,
      icono: input.icon,
      ordenVisualizacion: input.displayOrder,
      activo: input.active,
    });
    return toApiOfferType(tipo);
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError('Ya existe un tipo de oferta con ese nombre');
    }
    throw err;
  }
}

/**
 * PATCH /admin/offer-types/{offerTypeId} — "eliminar" un tipo de oferta
 * es `active: false` (mismo patrón que el resto del proyecto: ningún
 * catálogo compartido con datos ya dependientes se borra de verdad, ver
 * la migración tipos-oferta) — no hay un endpoint DELETE separado.
 * PATCH parcial real: un campo omitido conserva el valor existente,
 * mismo criterio que negocios.service.js/productos.service.js.
 */
async function actualizar(id, input) {
  const tipo = await obtenerCrudoOFallar(id);

  try {
    const actualizado = await tiposOfertaRepo.actualizar(id, {
      nombre: input.name !== undefined ? input.name : tipo.nombre,
      icono: input.icon !== undefined ? input.icon : tipo.icono,
      ordenVisualizacion:
        input.displayOrder !== undefined ? input.displayOrder : tipo.orden_visualizacion,
      activo: input.active !== undefined ? input.active : tipo.activo,
    });
    return toApiOfferType(actualizado);
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError('Ya existe un tipo de oferta con ese nombre');
    }
    throw err;
  }
}

module.exports = {
  listarActivos,
  listarTodos,
  obtenerCrudoOFallar,
  crear,
  actualizar,
  toApiOfferType,
};
