const ubicacionesRepo = require('../repositories/ubicaciones.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { toApiLocation, LOCATION_TYPE_API_TO_DB } = require('./business.mapper');
const { NotFoundError } = require('../errors');

/**
 * requesterId es null en la ruta pública sin token (o con uno inválido —
 * ver optionalAuthenticate en businesses.routes.js). Solo se usa para
 * decidir si quien pregunta es el propio dueño del negocio, y por lo
 * tanto ve la coordenada exacta sin importar la preferencia de
 * visibilidad pública del negocio (toApiLocation#requesterIsOwner) — ver
 * CLAUDE.md, "Mostrar dirección exacta / zona aproximada".
 */
async function obtenerActual(negocioId, requesterId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  const esPropietario = requesterId != null && negocio.usuario_id === requesterId;

  const ubicacion = await ubicacionesRepo.obtenerActual(negocioId);
  if (!ubicacion) {
    throw new NotFoundError('Este negocio todavía no tiene una ubicación registrada');
  }
  return toApiLocation(ubicacion, { requesterIsOwner: esPropietario });
}

async function actualizar(usuarioId, negocioId, input) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  const ubicacion = await ubicacionesRepo.reemplazarActual({
    negocioId,
    tipo: LOCATION_TYPE_API_TO_DB[input.type],
    direccionReferencia: input.referenceAddress,
    latitud: input.latitude,
    longitud: input.longitude,
    mostrarUbicacionExacta: input.showExactLocation,
  });

  // El dueño (única persona que puede llegar acá, ver authenticate +
  // verificarPropietario arriba) siempre ve la coordenada real que
  // acaba de registrar, sin importar la preferencia que haya elegido.
  return toApiLocation(ubicacion, { requesterIsOwner: true });
}

/** PATCH /businesses/{businessId}/location/visibility — ver CLAUDE.md. */
async function actualizarVisibilidad(usuarioId, negocioId, showExactLocation) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  const ubicacion = await ubicacionesRepo.actualizarVisibilidad(negocioId, showExactLocation);
  if (!ubicacion) {
    throw new NotFoundError('Este negocio todavía no tiene una ubicación registrada');
  }
  return toApiLocation(ubicacion, { requesterIsOwner: true });
}

module.exports = { obtenerActual, actualizar, actualizarVisibilidad };
