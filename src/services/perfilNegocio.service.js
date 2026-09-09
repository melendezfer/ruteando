const { obtenerCrudoOFallar } = require('./negocios.service');
const ubicacionesRepo = require('../repositories/ubicaciones.repository');
const horariosRepo = require('../repositories/horarios.repository');
const productosRepo = require('../repositories/productos.repository');
const fotosRepo = require('../repositories/fotos.repository');
const resenasRepo = require('../repositories/resenas.repository');
const solicitudesDisponibilidadRepo = require('../repositories/solicitudesDisponibilidad.repository');
const { toApiBusinessProfile } = require('./business.mapper');
const { AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES } = require('../config/constants');

/**
 * GET /businesses/{businessId} (RF-012): compone el perfil público
 * completo con una consulta por pieza, en paralelo — no hay una sola
 * consulta que junte todo porque cada pieza (ubicación, horario, menú,
 * fotos, reseñas) ya tenía su propio repositorio de una épica anterior;
 * recombinarlas acá evita duplicar esa lógica en un JOIN gigante.
 *
 * Ninguna pieza individual puede fallar la respuesta completa: un
 * negocio sin ubicación todavía (recién registrado, antes de RF-005) da
 * location: null, no un error — ver ubicacionesRepo.obtenerActual, que
 * ya devuelve null en vez de lanzar (a diferencia de
 * ubicacionService.obtenerActual, que si lanza NotFoundError — por eso
 * este archivo llama al repositorio directo, no al servicio, para las
 * piezas opcionales).
 */
/**
 * requesterId es null en la ruta pública sin token (o con uno inválido —
 * ver optionalAuthenticate, que a diferencia de tryAuthenticate sí
 * rechaza un token roto en vez de degradarlo a anónimo). Solo se usa para
 * decidir si el dueño real ve su propio rejectionReason (RF-020) — no
 * afecta nada más de la respuesta, que sigue siendo la misma para
 * cualquiera.
 */
async function obtener(id, requesterId) {
  const negocio = await obtenerCrudoOFallar(id);
  const esPropietario = requesterId != null && negocio.usuario_id === requesterId;

  const [ubicacion, horario, productos, fotos, agregadoResenas, availabilityConfirmedAt] =
    await Promise.all([
      ubicacionesRepo.obtenerActual(id),
      horariosRepo.listar(id),
      productosRepo.listarPorNegocio(id),
      fotosRepo.listarAprobadasPorNegocio(id),
      resenasRepo.obtenerAgregado(id),
      solicitudesDisponibilidadRepo.obtenerConfirmacionFresca(
        id,
        AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES,
      ),
    ]);

  return toApiBusinessProfile({
    negocio,
    ubicacion,
    horario,
    productos,
    fotos,
    agregadoResenas,
    esPropietario,
    availabilityConfirmedAt,
  });
}

module.exports = { obtener };
