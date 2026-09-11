const { z } = require('zod');
const resenasRepo = require('../repositories/resenas.repository');
const reportesResenaRepo = require('../repositories/reportesResena.repository');
const negociosService = require('./negocios.service');
const cursorUtil = require('../utils/cursor');
const { toApiReview } = require('./business.mapper');
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  ValidationError,
} = require('../errors');
const {
  REVIEW_REPORT_RATE_LIMIT_MAX,
  REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');

const CURSOR_SCHEMA = z.object({
  // Mismo criterio que negocios.service.js: no exige ISO estricto porque
  // el valor viaja tal cual lo devolvió Postgres (fecha_creacion::text),
  // solo que sea reconocible como fecha — protege contra un cursor
  // manipulado con un valor no parseable llegando al ::timestamptz.
  fechaCreacion: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: 'fechaCreacion no es una fecha válida',
    }),
  id: z.string().uuid(),
});

// Código de Postgres para unique_violation — ambas restricciones que
// usa este archivo (resenas.negocio_id+usuario_id y
// reportes_resena.resena_id+usuario_id) lo lanzan igual.
const PG_UNIQUE_VIOLATION = '23505';

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

async function obtenerCrudoOFallar(id) {
  const resena = await resenasRepo.buscarPorId(id);
  if (!resena) {
    throw new NotFoundError('Reseña no encontrada');
  }
  return resena;
}

function verificarAutor(resena, usuarioId) {
  if (resena.usuario_id !== usuarioId) {
    throw new ForbiddenError('No es el autor de esta reseña');
  }
}

async function crear(usuarioId, negocioId, input) {
  const negocio = await negociosService.obtenerCrudoOFallar(negocioId);
  // RF-015 + abuso obvio: inflar la propia calificación. La tabla no lo
  // impide a nivel de columna (no hay relación declarada entre
  // resenas.usuario_id y negocios.usuario_id) — verificación de
  // aplicación, como el resto de las reglas de autorización del proyecto.
  if (negocio.usuario_id === usuarioId) {
    throw new ForbiddenError('No puede reseñar su propio negocio');
  }

  let resena;
  try {
    resena = await resenasRepo.crear({
      negocioId,
      usuarioId,
      calificacion: input.rating,
      comentario: input.comment,
    });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError('Ya existe una reseña de este usuario para este negocio');
    }
    throw err;
  }

  return toApiReview(resena);
}

async function listar(negocioId, { cursor, limit }) {
  await negociosService.obtenerCrudoOFallar(negocioId);
  const cursorDecodificado = decodificarCursor(cursor);

  const filas = await resenasRepo.listarAprobadas({ negocioId, cursor: cursorDecodificado, limit });
  const hasMore = filas.length > limit;
  const pagina = hasMore ? filas.slice(0, limit) : filas;
  const ultima = pagina[pagina.length - 1];

  return {
    data: pagina.map(toApiReview),
    pagination: {
      nextCursor:
        hasMore && ultima
          ? cursorUtil.codificar({ fechaCreacion: ultima.fecha_creacion_cursor, id: ultima.id })
          : null,
      hasMore,
    },
  };
}

/** GET /users/me/reviews (Épica F6) — ver resenas.repository.js#listarPorUsuario. */
async function listarPorUsuario(usuarioId, { cursor, limit }) {
  const cursorDecodificado = decodificarCursor(cursor);

  const filas = await resenasRepo.listarPorUsuario({ usuarioId, cursor: cursorDecodificado, limit });
  const hasMore = filas.length > limit;
  const pagina = hasMore ? filas.slice(0, limit) : filas;
  const ultima = pagina[pagina.length - 1];

  return {
    data: pagina.map((fila) => ({ ...toApiReview(fila), businessName: fila.negocio_nombre })),
    pagination: {
      nextCursor:
        hasMore && ultima
          ? cursorUtil.codificar({ fechaCreacion: ultima.fecha_creacion_cursor, id: ultima.id })
          : null,
      hasMore,
    },
  };
}

async function eliminar(usuarioId, id) {
  const resena = await obtenerCrudoOFallar(id);
  verificarAutor(resena, usuarioId);
  await resenasRepo.eliminar(id);
}

async function reportar(usuarioId, id) {
  await obtenerCrudoOFallar(id);

  const recientes = await reportesResenaRepo.contarRecientesDelOrigen({
    usuarioId,
    windowMinutes: REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  });
  if (recientes >= REVIEW_REPORT_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError(
      `Demasiados reportes desde este usuario (máximo ${REVIEW_REPORT_RATE_LIMIT_MAX} por ${REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES} min)`,
    );
  }

  try {
    await reportesResenaRepo.crear({ resenaId: id, usuarioId });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw new ConflictError('Ya reportó esta reseña');
    }
    throw err;
  }

  await resenasRepo.marcarPendiente(id);
}

module.exports = {
  crear,
  listar,
  listarPorUsuario,
  eliminar,
  reportar,
  obtenerCrudoOFallar,
  verificarAutor,
};
