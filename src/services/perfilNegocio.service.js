const { obtenerCrudoOFallar } = require('./negocios.service');
const ubicacionesRepo = require('../repositories/ubicaciones.repository');
const horariosRepo = require('../repositories/horarios.repository');
const productosRepo = require('../repositories/productos.repository');
const fotosRepo = require('../repositories/fotos.repository');
const resenasRepo = require('../repositories/resenas.repository');
const { toApiBusinessProfile } = require('./business.mapper');

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
async function obtener(id) {
  const negocio = await obtenerCrudoOFallar(id);

  const [ubicacion, horario, productos, fotos, agregadoResenas] = await Promise.all([
    ubicacionesRepo.obtenerActual(id),
    horariosRepo.listar(id),
    productosRepo.listarPorNegocio(id),
    fotosRepo.listarPorNegocio(id),
    resenasRepo.obtenerAgregado(id),
  ]);

  return toApiBusinessProfile({ negocio, ubicacion, horario, productos, fotos, agregadoResenas });
}

module.exports = { obtener };
