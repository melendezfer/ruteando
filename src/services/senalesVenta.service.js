const senalesVentaRepo = require('../repositories/senalesVenta.repository');
const posicionesRepo = require('../repositories/posicionesEnVivo.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { ConflictError, TooManyRequestsError } = require('../errors');
const {
  AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES,
  SELLING_NOW_MIN_INTERVAL_MINUTES,
  SELLING_NOW_DAILY_MAX,
} = require('../config/constants');

// `type` propio (RFC 9457): el cliente muestra un mensaje específico
// ("según tu horario ahora estás cerrado") en vez del 409 genérico.
const TIPO_FUERA_DE_HORARIO = 'https://api.ciudadverdegastronomica.co/errors/selling-now-off-schedule';

function expiraEn(confirmadaEn) {
  return new Date(
    new Date(confirmadaEn).getTime() + AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES * 60 * 1000,
  ).toISOString();
}

/**
 * PUT /businesses/{businessId}/selling-now — R5, "Estoy vendiendo ahora"
 * (docs/specs/r5-estoy-vendiendo.md). Orden de las reglas: dueño (403),
 * negocio activo (409), dentro de su horario o de una franja (409 con
 * type propio, DP-1), intervalo mínimo (200 con saved: false) y tope de
 * 24 h (429).
 */
async function confirmar(usuarioId, negocioId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  if (negocio.estado !== 'activo') {
    throw new ConflictError('Solo un negocio activo puede avisar que está vendiendo');
  }

  if (!(await posicionesRepo.estaEnHorarioOFranja(negocioId))) {
    throw new ConflictError(
      'Según tu horario ahora estás cerrado. Si estás vendiendo, actualiza tu horario o tus puntos por hora.',
      TIPO_FUERA_DE_HORARIO,
    );
  }

  const r = await senalesVentaRepo.registrarVendiendo({
    negocioId,
    usuarioId,
    freshnessMinutes: AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES,
    intervaloMinutos: SELLING_NOW_MIN_INTERVAL_MINUTES,
    maxDiario: SELLING_NOW_DAILY_MAX,
  });

  if (r.resultado === 'limite') {
    throw new TooManyRequestsError(
      `Ya avisaste ${SELLING_NOW_DAILY_MAX} veces en las últimas 24 horas. Tu aviso actual sigue vigente hasta que se venza.`,
    );
  }

  return {
    availabilityConfirmedAt: new Date(r.confirmadaEn).toISOString(),
    expiresAt: expiraEn(r.confirmadaEn),
    saved: r.resultado === 'guardada',
  };
}

/** DELETE /businesses/{businessId}/selling-now — "Ya no estoy vendiendo". Idempotente. */
async function dejar(usuarioId, negocioId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);
  await senalesVentaRepo.registrarDejoDeVender({
    negocioId,
    usuarioId,
    freshnessMinutes: AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES,
  });
}

module.exports = { confirmar, dejar, TIPO_FUERA_DE_HORARIO };
