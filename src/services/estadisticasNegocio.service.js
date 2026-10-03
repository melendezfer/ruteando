const estadisticasRepo = require('../repositories/estadisticasNegocio.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');

function numeroOCero(v) {
  return v == null ? 0 : Number(v);
}

function promedio(v) {
  return v == null ? null : Math.round(Number(v) * 10) / 10;
}

/**
 * GET /businesses/{businessId}/stats — "Tu semana" del tablero
 * (docs/specs/perfil-2.md §4.4, §7.4). Solo el dueño (403 a otra persona).
 */
async function obtener(usuarioId, negocioId, dias) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  const [eventos, resenas] = await Promise.all([
    estadisticasRepo.contarEventos(negocioId, dias),
    estadisticasRepo.resumirResenas(negocioId, dias),
  ]);

  return {
    days: dias,
    current: {
      profileViews: numeroOCero(eventos.vistas_actual),
      contacts: numeroOCero(eventos.contactos_actual),
      averageRating: promedio(resenas.promedio_actual),
      ratingCount: numeroOCero(resenas.total_actual),
    },
    previous: {
      profileViews: numeroOCero(eventos.vistas_anterior),
      contacts: numeroOCero(eventos.contactos_anterior),
      averageRating: promedio(resenas.promedio_anterior),
      ratingCount: numeroOCero(resenas.total_anterior),
    },
    pendingReviews: numeroOCero(resenas.pendientes),
  };
}

module.exports = { obtener };
