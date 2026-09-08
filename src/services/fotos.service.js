const crypto = require('node:crypto');
const fotosRepo = require('../repositories/fotos.repository');
const negociosService = require('./negocios.service');
const productosService = require('./productos.service');
const imagenService = require('./imagen.service');
const almacenamientoService = require('./almacenamiento.service');
const { toApiPhoto } = require('./business.mapper');
const { NotFoundError } = require('../errors');

async function subirYGuardar({ negocioId, productoId, tipo, archivo }) {
  const { buffer, contentType, extension } = await imagenService.procesar(archivo.buffer);

  const orden = await fotosRepo.siguienteOrden({ negocioId, productoId });
  const key = `fotos/${tipo}/${negocioId ?? productoId}/${crypto.randomUUID()}.${extension}`;
  const url = await almacenamientoService.subir(key, buffer, contentType);

  const foto = await fotosRepo.crear({
    negocioId,
    productoId,
    tipo,
    url,
    ordenVisualizacion: orden,
  });

  return toApiPhoto(foto);
}

async function subirParaNegocio(usuarioId, negocioId, archivo) {
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  negociosService.verificarPropietario(negocio, usuarioId);

  return subirYGuardar({ negocioId, productoId: null, tipo: 'negocio', archivo });
}

async function subirParaProducto(usuarioId, productoId, archivo) {
  const producto = await productosService.obtenerCrudoOFallar(productoId);
  await productosService.verificarPropietarioDelProducto(producto, usuarioId);

  return subirYGuardar({ negocioId: null, productoId, tipo: 'producto', archivo });
}

async function resolverNegocioIdDeFoto(foto) {
  if (foto.negocio_id) return foto.negocio_id;
  const producto = await productosService.obtenerCrudoOFallar(foto.producto_id);
  return producto.negocio_id;
}

async function eliminar(usuarioId, id, logger) {
  const foto = await fotosRepo.buscarPorId(id);
  if (!foto) {
    throw new NotFoundError('Foto no encontrada');
  }

  const negocioId = await resolverNegocioIdDeFoto(foto);
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  negociosService.verificarPropietario(negocio, usuarioId);

  // Primero se intenta liberar el objeto remoto (best-effort, no bloquea
  // el borrado si el storage falla — ver almacenamiento.service.js) y
  // luego se borra la fila; en ese orden, si el proceso se cae entre
  // medio, el peor caso es un objeto huérfano en el bucket, nunca una
  // fila en la base de datos que apunta a un archivo que ya no existe.
  await almacenamientoService.borrarPorUrlSilencioso(foto.url, logger);
  await fotosRepo.eliminar(id);
}

module.exports = { subirParaNegocio, subirParaProducto, eliminar };
