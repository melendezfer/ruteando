const productosRepo = require('../repositories/productos.repository');
const categoriasRepo = require('../repositories/categorias.repository');
const tiposOfertaRepo = require('../repositories/tiposOferta.repository');
const fotosRepo = require('../repositories/fotos.repository');
const negociosService = require('./negocios.service');
const almacenamientoService = require('./almacenamiento.service');
const { toApiProduct } = require('./business.mapper');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { FREE_PLAN_MAX_ACTIVE_OFFERS, FREE_PLAN_MAX_CATALOG_PRODUCTS } = require('../config/constants');

async function validarCategoria(categoryId) {
  if (categoryId == null) return;
  if (!(await categoriasRepo.existePorId(categoryId))) {
    throw new ValidationError('La categoría indicada no existe', {
      errors: [{ field: 'categoryId', message: 'No existe una categoría con ese id' }],
    });
  }
}

async function validarTipoOferta(offerTypeId) {
  if (offerTypeId == null) return;
  if (!(await tiposOfertaRepo.existePorId(offerTypeId))) {
    throw new ValidationError('El tipo de oferta indicado no existe', {
      errors: [{ field: 'offerTypeId', message: 'No existe un tipo de oferta con ese id' }],
    });
  }
}

/**
 * Plan gratis: máximo FREE_PLAN_MAX_ACTIVE_OFFERS productos con vigencia
 * activa por negocio a la vez (ver CLAUDE.md, migración negocios-plan) —
 * el plan pago no tiene este límite. `vigenciaInicio` (no `offerTypeId`)
 * es la señal real de "esto es una oferta que ocupa el cupo" — ver el
 * comentario completo en la migración productos-tipo-oferta.
 * `excluirProductoId` deja que un PATCH sobre una oferta ya existente no
 * choque contra sí misma.
 */
async function validarLimiteOfertaGratis(negocio, { vigenciaInicio, excluirProductoId }) {
  if (vigenciaInicio == null) return;
  if (negocio.plan !== 'gratis') return;

  const total = await productosRepo.contarOfertasVigentes(negocio.id, { excluirProductoId });
  if (total >= FREE_PLAN_MAX_ACTIVE_OFFERS) {
    throw new ConflictError(
      `El plan gratis permite máximo ${FREE_PLAN_MAX_ACTIVE_OFFERS} oferta(s) con vigencia activa a la vez — espera a que la actual venza o pasa al plan pago`,
    );
  }
}

/**
 * Plan gratis: máximo FREE_PLAN_MAX_CATALOG_PRODUCTS productos de
 * CATÁLOGO NORMAL (sin vigencia) por negocio a la vez — sin RF asociado,
 * petición directa del usuario (ver CLAUDE.md, tarea aparte de
 * requiere_horario_negocio/"Cerca de ti ahora"). Cupo independiente del
 * de ofertas (validarLimiteOfertaGratis arriba): un producto con
 * vigencia (`vigenciaInicio` presente) nunca lo ocupa. Sin mostrar
 * costo ni ofrecer ningún flujo de pago en el mensaje (CLAUDE.md sección
 * 15) — solo señala que el plan pago no tiene este límite.
 */
async function validarLimiteCatalogoGratis(negocio, { vigenciaInicio, excluirProductoId }) {
  if (vigenciaInicio != null) return; // es una oferta, no ocupa el cupo de catálogo
  if (negocio.plan !== 'gratis') return;

  const total = await productosRepo.contarProductosCatalogo(negocio.id, { excluirProductoId });
  if (total >= FREE_PLAN_MAX_CATALOG_PRODUCTS) {
    throw new ConflictError(
      `Disponible en el plan pago — el plan gratis permite máximo ${FREE_PLAN_MAX_CATALOG_PRODUCTS} productos en el catálogo (sin contar ofertas con vigencia)`,
    );
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
  await validarTipoOferta(input.offerTypeId);
  await validarLimiteOfertaGratis(negocio, { vigenciaInicio: input.validFrom });
  await validarLimiteCatalogoGratis(negocio, { vigenciaInicio: input.validFrom });

  const producto = await productosRepo.crear({
    negocioId,
    categoriaId: input.categoryId,
    nombre: input.name,
    descripcion: input.description,
    precio: input.price,
    // Sin .default(true) en el schema (ver product.validators.js) — el
    // valor por defecto de creación se aplica aquí, no en el validador.
    disponible: input.available !== undefined ? input.available : true,
    tipoOfertaId: input.offerTypeId,
    vigenciaInicio: input.validFrom,
    vigenciaFin: input.validUntil,
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
  const negocio = await negociosService.obtenerCrudoOFallar(producto.negocio_id);
  negociosService.verificarPropietario(negocio, usuarioId);
  await validarCategoria(input.categoryId);
  await validarTipoOferta(input.offerTypeId);

  // PATCH parcial de verdad, mismo patrón que negocios.service.js: si el
  // cliente no manda un campo (queda undefined tras zod), se conserva el
  // valor existente en vez de borrarlo.
  const vigenciaInicio = input.validFrom !== undefined ? input.validFrom : producto.vigencia_inicio;

  await validarLimiteOfertaGratis(negocio, { vigenciaInicio, excluirProductoId: id });
  await validarLimiteCatalogoGratis(negocio, { vigenciaInicio, excluirProductoId: id });

  const actualizado = await productosRepo.actualizar(id, {
    categoriaId: input.categoryId !== undefined ? input.categoryId : producto.categoria_id,
    nombre: input.name !== undefined ? input.name : producto.nombre,
    descripcion: input.description !== undefined ? input.description : producto.descripcion,
    precio: input.price !== undefined ? input.price : producto.precio,
    disponible: input.available !== undefined ? input.available : producto.disponible,
    tipoOfertaId: input.offerTypeId !== undefined ? input.offerTypeId : producto.tipo_oferta_id,
    vigenciaInicio,
    vigenciaFin: input.validUntil !== undefined ? input.validUntil : producto.vigencia_fin,
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
