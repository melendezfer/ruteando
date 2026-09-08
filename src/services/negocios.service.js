const { z } = require('zod');
const negociosRepo = require('../repositories/negocios.repository');
const categoriasRepo = require('../repositories/categorias.repository');
const cursorUtil = require('../utils/cursor');
const { toApiBusiness } = require('./business.mapper');
const { NotFoundError, ForbiddenError, ValidationError } = require('../errors');

const CURSOR_LISTAR_SCHEMA = z.object({
  // No exige un formato ISO estricto a propósito — el valor viaja tal
  // cual lo devolvió Postgres (n.fecha_creacion::text en
  // negocios.repository.js, con precisión de microsegundos) y se manda
  // de vuelta sin tocar para el cast $N::timestamptz, así que el único
  // requisito real es que Date.parse() lo reconozca como una fecha
  // válida — sin esto, un cursor con fechaCreacion:"garbage" pasaba el
  // schema y llegaba al cast de Postgres, que lo rechazaba con un error
  // crudo (500) en vez del 422 que promete decodificarCursor.
  fechaCreacion: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: 'fechaCreacion no es una fecha válida',
    }),
  id: z.string().uuid(),
});
const CURSOR_CERCANOS_SCHEMA = z.object({ distanceMeters: z.number(), id: z.string().uuid() });

/**
 * Decodifica y valida la forma del cursor que mandó el cliente — nunca
 * confiar en que sigue siendo lo que se le entregó (regla de seguridad
 * #1): un cursor manipulado a mano no debe llegar a la consulta
 * parametrizada, debe rechazarse como 422 antes.
 */
function decodificarCursor(cursorTexto, schema) {
  if (!cursorTexto) return null;
  const payload = cursorUtil.decodificar(cursorTexto);
  const resultado = schema.safeParse(payload);
  if (!resultado.success) {
    throw new ValidationError('El cursor de paginación no es válido', {
      errors: [{ field: 'cursor', message: 'Formato de cursor inválido o corrupto' }],
    });
  }
  return resultado.data;
}

/**
 * Pide limit+1 filas al repositorio (ver negocios.repository.js) y usa la
 * fila de más para saber si hay una página siguiente sin un COUNT(*)
 * aparte — la corta antes de mapear al contrato.
 */
function armarPagina(filas, limit, construirCursor) {
  const hasMore = filas.length > limit;
  const pagina = hasMore ? filas.slice(0, limit) : filas;
  const ultima = pagina[pagina.length - 1];

  return {
    data: pagina.map(toApiBusiness),
    pagination: {
      nextCursor: hasMore && ultima ? cursorUtil.codificar(construirCursor(ultima)) : null,
      hasMore,
    },
  };
}

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

async function listar(filtros) {
  const cursor = decodificarCursor(filtros.cursor, CURSOR_LISTAR_SCHEMA);

  const filas = await negociosRepo.listar({ ...filtros, cursor });

  return armarPagina(filas, filtros.limit, (ultima) => ({
    // fecha_creacion_cursor es el texto crudo que devolvió Postgres
    // (n.fecha_creacion::text en negocios.repository.js), con precisión
    // de microsegundos — nunca pasa por un JS Date, que trunca a
    // milisegundos y podía saltarse filas al paginar (ver comentario en
    // el repositorio).
    fechaCreacion: ultima.fecha_creacion_cursor,
    id: ultima.id,
  }));
}

async function cercanos(filtros) {
  const cursor = decodificarCursor(filtros.cursor, CURSOR_CERCANOS_SCHEMA);

  const filas = await negociosRepo.cercanos({ ...filtros, cursor });

  return armarPagina(filas, filtros.limit, (ultima) => ({
    distanceMeters: Number(ultima.distancia_m),
    id: ultima.id,
  }));
}

module.exports = {
  crear,
  actualizar,
  cerrar,
  listar,
  cercanos,
  obtenerCrudoOFallar,
  verificarPropietario,
};
