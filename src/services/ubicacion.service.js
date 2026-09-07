const ubicacionesRepo = require('../repositories/ubicaciones.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { toApiLocation, LOCATION_TYPE_API_TO_DB } = require('./business.mapper');
const { NotFoundError } = require('../errors');

async function obtenerActual(negocioId) {
  await obtenerCrudoOFallar(negocioId);

  const ubicacion = await ubicacionesRepo.obtenerActual(negocioId);
  if (!ubicacion) {
    throw new NotFoundError('Este negocio todavía no tiene una ubicación registrada');
  }
  return toApiLocation(ubicacion);
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
  });

  return toApiLocation(ubicacion);
}

module.exports = { obtenerActual, actualizar };
