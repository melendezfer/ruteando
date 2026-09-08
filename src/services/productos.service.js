const productosRepo = require('../repositories/productos.repository');
const categoriasRepo = require('../repositories/categorias.repository');
const fotosRepo = require('../repositories/fotos.repository');
const negociosService = require('./negocios.service');
const almacenamientoService = require('./almacenamiento.service');
const { toApiProduct } = require('./business.mapper');
const { NotFoundError, ValidationError } = require('../errors');

async function validarCategoria(categoryId) {
  if (categoryId == null) return;
  if (!(await categoriasRepo.existePorId(categoryId))) {
    throw new ValidationError('La categoría indicada no existe', {
      errors: [{ field: 'categoryId', message: 'No existe una categoría con ese id' }],
    });
  }
}

async function obtenerCrudoOFallar(id) {
  const producto = await productosRepo.buscarPorId(id);
  if (!producto) {
    throw new NotFoundError('Producto no encontrado');
  }
  return producto;
}

/**
 * Un producto no tiene dueño propio — pertenece a un negocio, que sí lo
 * tiene. Reusa negociosService.verificarPropietario (misma regla de
 * seguridad #2 en toda la app) en vez de duplicar la comparación.
 */
async function verificarPropietarioDelProducto(producto, usuarioId) {
  const negocio = await negociosService.obtenerCrudoOFallar(producto.negocio_id);
  negociosService.verificarPropietario(negocio, usuarioId);
}

async function crear(usuarioId, negocioId, input) {
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  negociosService.verificarPropietario(negocio, usuarioId);
  await validarCategoria(input.categoryId);

  const producto = await productosRepo.crear({
    negocioId,
    categoriaId: input.categoryId,
    nombre: input.name,
    descripcion: input.description,
    precio: input.price,
    // Sin .default(true) en el schema (ver product.validators.js) — el
    // valor por defecto de creación se aplica aquí, no en el validador.
    disponible: input.available !== undefined ? input.available : true,
  });

  return toApiProduct(producto);
}

async function listar(negocioId) {
  await negociosService.obtenerCrudoOFallar(negocioId);
  const productos = await productosRepo.listarPorNegocio(negocioId);
  return productos.map(toApiProduct);
}

async function obtener(id) {
  const producto = await obtenerCrudoOFallar(id);
  return toApiProduct(producto);
}

async function actualizar(usuarioId, id, input) {
  const producto = await obtenerCrudoOFallar(id);
  await verificarPropietarioDelProducto(producto, usuarioId);
  await validarCategoria(input.categoryId);

  // PATCH parcial de verdad, mismo patrón que negocios.service.js: si el
  // cliente no manda un campo (queda undefined tras zod), se conserva el
  // valor existente en vez de borrarlo.
  const actualizado = await productosRepo.actualizar(id, {
    categoriaId: input.categoryId !== undefined ? input.categoryId : producto.categoria_id,
    nombre: input.name !== undefined ? input.name : producto.nombre,
    descripcion: input.description !== undefined ? input.description : producto.descripcion,
    precio: input.price !== undefined ? input.price : producto.precio,
    disponible: input.available !== undefined ? input.available : producto.disponible,
  });

  return toApiProduct(actualizado);
}

async function eliminar(usuarioId, id, logger) {
  const producto = await obtenerCrudoOFallar(id);
  await verificarPropietarioDelProducto(producto, usuarioId);

  // El ON DELETE CASCADE de fotos.producto_id borra las filas en la base
  // de datos, pero no libera los objetos en el bucket — hay que buscarlas
  // antes de borrar el producto y limpiarlas (best-effort, ver
  // almacenamiento.service.js) para no dejar huérfanos.
  const fotos = await fotosRepo.listarPorProducto(id);
  await productosRepo.eliminar(id);

  // En paralelo: son borrados independientes y borrarPorUrlSilencioso ya
  // atrapa sus propios errores (best-effort), así que no hay nada que
  // esperar en serie.
  await Promise.allSettled(
    fotos.map((foto) => almacenamientoService.borrarPorUrlSilencioso(foto.url, logger)),
  );
}

module.exports = {
  crear,
  listar,
  obtener,
  actualizar,
  eliminar,
  obtenerCrudoOFallar,
  verificarPropietarioDelProducto,
};
