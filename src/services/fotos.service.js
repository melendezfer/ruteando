const crypto = require('node:crypto');
const fotosRepo = require('../repositories/fotos.repository');
const reportesFotoRepo = require('../repositories/reportesFoto.repository');
const negociosService = require('./negocios.service');
const productosService = require('./productos.service');
const imagenService = require('./imagen.service');
const almacenamientoService = require('./almacenamiento.service');
const { toApiPhoto } = require('./business.mapper');
const { NotFoundError, ConflictError, TooManyRequestsError } = require('../errors');
const {
  PHOTO_REPORT_RATE_LIMIT_MAX,
  PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');

// Código de Postgres para unique_violation — lo lanza el UNIQUE(foto_id,
// usuario_id) de reportes_foto (ver migración fotos-moderacion).
const PG_UNIQUE_VIOLATION = '23505';

async function subirYGuardar({ negocioId, productoId, tipo, archivo, logger }) {
  const { buffer, contentType, extension } = await imagenService.procesar(archivo.buffer);

  const key = `fotos/${tipo}/${negocioId ?? productoId}/${crypto.randomUUID()}.${extension}`;
  const url = await almacenamientoService.subir(key, buffer, contentType);

  let foto;
  try {
    foto = await fotosRepo.crearConOrdenSiguiente({ negocioId, productoId, tipo, url });
  } catch (err) {
    // El objeto ya se subió cuando esto falla (ej. error transitorio de
    // conexión a la base de datos) — sin esta limpieza quedaría huérfano
    // en el bucket para siempre, sin ninguna fila que lo referencie.
    await almacenamientoService.borrarPorUrlSilencioso(url, logger);
    throw err;
  }

  return toApiPhoto(foto);
}

async function subirParaNegocio(usuarioId, negocioId, archivo, logger) {
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  negociosService.verificarPropietario(negocio, usuarioId);

  return subirYGuardar({ negocioId, productoId: null, tipo: 'negocio', archivo, logger });
}

async function subirParaProducto(usuarioId, productoId, archivo, logger) {
  const producto = await productosService.obtenerCrudoOFallar(productoId);
  await productosService.verificarPropietarioDelProducto(producto, usuarioId);

  return subirYGuardar({ negocioId: null, productoId, tipo: 'producto', archivo, logger });
}

async function obtenerCrudoOFallar(id) {
  const foto = await fotosRepo.buscarPorId(id);
  if (!foto) {
    throw new NotFoundError('Foto no encontrada');
  }
  return foto;
}

async function resolverNegocioIdDeFoto(foto) {
  if (foto.negocio_id) return foto.negocio_id;
  const producto = await productosService.obtenerCrudoOFallar(foto.producto_id);
  return producto.negocio_id;
}

async function eliminar(usuarioId, id, logger) {
  const foto = await obtenerCrudoOFallar(id);

  const negocioId = await resolverNegocioIdDeFoto(foto);
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  negociosService.verificarPropietario(negocio, usuarioId);

  // Primero se borra la fila y luego, best-effort, se intenta liberar el
  // objeto remoto (ver almacenamiento.service.js) — en ese orden, si el
  // proceso se cae entre medio, el peor caso es un objeto huérfano en el
  // bucket, nunca una fila en la base de datos que sigue apuntando a un
  // archivo que ya no existe.
  await fotosRepo.eliminar(id);
  await almacenamientoService.borrarPorUrlSilencioso(foto.url, logger);
}

/**
 * POST /photos/{photoId}/report (Épica 9, gap dejado pendiente desde la
 * Épica 6) — calca resenas.service.js#reportar: siempre autenticado
 * (mismo criterio, no es anónimo como RF-025), doble capa contra abuso
 * (UNIQUE en base de datos + límite de tasa por origen), y un reporte
 * exitoso mueve la foto a 'pendiente' de inmediato (sale de
 * listarAprobadasPorNegocio hasta que la Épica 9 la revise), sin
 * condicionarlo a su estado anterior.
 */
async function reportar(usuarioId, id) {
  await obtenerCrudoOFallar(id);

  const recientes = await reportesFotoRepo.contarRecientesDelOrigen({
    usuarioId,
    windowMinutes: PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  });
  if (recientes >= PHOTO_REPORT_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError(
      `Demasiados reportes desde este usuario (máximo ${PHOTO_REPORT_RATE_LIMIT_MAX} por ${PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES} min)`,
    );
  }

  try {
    await reportesFotoRepo.crear({ fotoId: id, usuarioId });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError('Ya reportó esta foto');
    }
    throw err;
  }

  await fotosRepo.moderar(id, 'pendiente');
}

module.exports = { subirParaNegocio, subirParaProducto, eliminar, reportar, obtenerCrudoOFallar };
