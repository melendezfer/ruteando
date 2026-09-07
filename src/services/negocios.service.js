const negociosRepo = require('../repositories/negocios.repository');
const categoriasRepo = require('../repositories/categorias.repository');
const { toApiBusiness } = require('./business.mapper');
const { NotFoundError, ForbiddenError, ValidationError } = require('../errors');

async function validarCategoria(categoryId) {
  if (!(await categoriasRepo.existePorId(categoryId))) {
    throw new ValidationError('La categoría indicada no existe', {
      errors: [{ field: 'categoryId', message: 'No existe una categoría con ese id' }],
    });
  }
}

async function obtenerCrudoOFallar(id) {
  const negocio = await negociosRepo.buscarPorId(id);
  if (!negocio) {
    throw new NotFoundError('Negocio no encontrado');
  }
  return negocio;
}

function verificarPropietario(negocio, usuarioId) {
  if (negocio.usuario_id !== usuarioId) {
    throw new ForbiddenError('No es el propietario de este negocio');
  }
}

async function crear(usuarioId, input) {
  await validarCategoria(input.categoryId);

  const negocio = await negociosRepo.crear({
    usuarioId,
    categoriaId: input.categoryId,
    nombre: input.name,
    descripcion: input.description,
    telefonoContacto: input.contactPhone,
  });

  return toApiBusiness(negocio);
}

async function obtener(id) {
  const negocio = await obtenerCrudoOFallar(id);
  return toApiBusiness(negocio);
}

async function actualizar(usuarioId, id, input) {
  const negocio = await obtenerCrudoOFallar(id);
  verificarPropietario(negocio, usuarioId);
  await validarCategoria(input.categoryId);

  // PATCH parcial de verdad: si el cliente no manda description/contactPhone
  // (quedan undefined tras el parseo de zod), se conserva el valor
  // existente en vez de borrarlo — reemplazarlo por completo solo porque
  // BusinessInput comparte schema con POST sería una pérdida de datos
  // silenciosa.
  const actualizado = await negociosRepo.actualizar(id, {
    categoriaId: input.categoryId,
    nombre: input.name,
    descripcion: input.description !== undefined ? input.description : negocio.descripcion,
    telefonoContacto:
      input.contactPhone !== undefined ? input.contactPhone : negocio.telefono_contacto,
  });

  return toApiBusiness(actualizado);
}

async function cerrar(usuarioId, id) {
  const negocio = await obtenerCrudoOFallar(id);
  verificarPropietario(negocio, usuarioId);
  await negociosRepo.cerrar(id);
}

module.exports = { crear, obtener, actualizar, cerrar, obtenerCrudoOFallar, verificarPropietario };
