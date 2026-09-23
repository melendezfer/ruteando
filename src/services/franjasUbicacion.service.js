const franjasRepo = require('../repositories/franjasUbicacion.repository');
const ubicacionesRepo = require('../repositories/ubicaciones.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { toApiLocationSlot, DAY_API_TO_DB } = require('./business.mapper');
const { ConflictError } = require('../errors');

/**
 * Franjas del día con ubicación propia de un vendedor ambulante
 * (migración franjas-ubicacion-ambulante). Públicas para leer (el
 * consumidor puede ver dónde suele estar el vendedor a cada hora), con la
 * misma regla de "zona aproximada" que la ubicación base: solo el dueño
 * ve la coordenada exacta si el negocio eligió ocultarla.
 */
async function obtener(negocioId, requesterId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  const esPropietario = requesterId != null && negocio.usuario_id === requesterId;
  const [franjas, ubicacionBase] = await Promise.all([
    franjasRepo.listar(negocioId),
    ubicacionesRepo.obtenerActual(negocioId),
  ]);
  const mostrarExacta = esPropietario || Boolean(ubicacionBase?.mostrar_ubicacion_exacta);
  return franjas.map((f) => toApiLocationSlot(f, { mostrarExacta }));
}

/**
 * Reemplazo completo (mismo contrato que PUT .../schedule). Solo un
 * negocio 'ambulante' puede declarar franjas: un puesto fijo o un local no
 * cambian de sitio a lo largo del día — 409 en vez de guardarlas sin
 * efecto (la consulta de lectura igual las ignoraría, ver
 * negocios.repository.js#lateralFranjaActiva), para que el vendedor sepa
 * por qué no le sirven. Un PUT con lista vacía sí se acepta en cualquier
 * modalidad: es la forma de borrarlas después de cambiar de modalidad.
 */
async function reemplazar(usuarioId, negocioId, franjasInput) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  if (franjasInput.length > 0 && negocio.movilidad !== 'ambulante') {
    throw new ConflictError(
      'Solo un negocio ambulante puede tener franjas del día con ubicaciones distintas — cambia la modalidad a "ambulante" primero',
    );
  }

  await franjasRepo.reemplazarTodas(
    negocioId,
    franjasInput.map((f) => ({
      dia: DAY_API_TO_DB[f.day],
      horaInicio: f.startTime,
      horaFin: f.endTime,
      latitud: f.latitude,
      longitud: f.longitude,
      direccionReferencia: f.referenceAddress,
    })),
  );

  const guardadas = await franjasRepo.listar(negocioId);
  return guardadas.map((f) => toApiLocationSlot(f, { mostrarExacta: true }));
}

module.exports = { obtener, reemplazar };
