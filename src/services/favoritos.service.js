const { z } = require('zod');
const favoritosRepo = require('../repositories/favoritos.repository');
const negociosService = require('./negocios.service');
const cursorUtil = require('../utils/cursor');
const { toApiBusiness } = require('./business.mapper');
const { ValidationError } = require('../errors');

const CURSOR_SCHEMA = z.object({
  fechaCreacion: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: 'fechaCreacion no es una fecha válida',
    }),
  negocioId: z.string().uuid(),
});

function decodificarCursor(cursorTexto) {
  if (!cursorTexto) return null;
  const payload = cursorUtil.decodificar(cursorTexto);
  const resultado = CURSOR_SCHEMA.safeParse(payload);
  if (!resultado.success) {
    throw new ValidationError('El cursor de paginación no es válido', {
      errors: [{ field: 'cursor', message: 'Formato de cursor inválido o corrupto' }],
    });
  }
  return resultado.data;
}

async function marcar(usuarioId, negocioId) {
  await negociosService.obtenerCrudoOFallar(negocioId);
  await favoritosRepo.marcar(usuarioId, negocioId);
}

async function desmarcar(usuarioId, negocioId) {
  await negociosService.obtenerCrudoOFallar(negocioId);
  await favoritosRepo.desmarcar(usuarioId, negocioId);
}

async function listar(usuarioId, { cursor, limit }) {
  const cursorDecodificado = decodificarCursor(cursor);

  const filas = await favoritosRepo.listar({ usuarioId, cursor: cursorDecodificado, limit });
  const hasMore = filas.length > limit;
  const pagina = hasMore ? filas.slice(0, limit) : filas;
  const ultima = pagina[pagina.length - 1];

  return {
    data: pagina.map(toApiBusiness),
    pagination: {
      nextCursor:
        hasMore && ultima
          ? cursorUtil.codificar({
              fechaCreacion: ultima.favorito_fecha_creacion_cursor,
              negocioId: ultima.id,
            })
          : null,
      hasMore,
    },
  };
}

module.exports = { marcar, desmarcar, listar };
