const crypto = require('node:crypto');
const fotosRepo = require('../repositories/fotos.repository');
const negociosService = require('./negocios.service');
const productosService = require('./productos.service');
const imagenService = require('./imagen.service');
const almacenamientoService = require('./almacenamiento.service');
const { toApiPhoto } = require('./business.mapper');
const { NotFoundError } = require('../errors');

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

  // Primero se borra la fila y luego, best-effort, se intenta liberar el
  // objeto remoto (ver almacenamiento.service.js) — en ese orden, si el
  // proceso se cae entre medio, el peor caso es un objeto huérfano en el
  // bucket, nunca una fila en la base de datos que sigue apuntando a un
  // archivo que ya no existe.
  await fotosRepo.eliminar(id);
  await almacenamientoService.borrarPorUrlSilencioso(foto.url, logger);
}

module.exports = { subirParaNegocio, subirParaProducto, eliminar };
