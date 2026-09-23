const posicionesRepo = require('../repositories/posicionesEnVivo.repository');
const consentimientosRepo = require('../repositories/consentimientos.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { ConflictError, ConsentRequiredError } = require('../errors');

// `type` propio (RFC 9457) para que el cliente distinga "tu horario
// terminó" de cualquier otro 409 y apague el interruptor solo, en vez de
// seguir reintentando.
const TIPO_FUERA_DE_HORARIO = 'https://api.ciudadverdegastronomica.co/errors/live-location-off-schedule';

/**
 * POST /businesses/{businessId}/live-location — una posición del vendedor
 * ambulante, enviada por su propio navegador mientras tiene la app
 * abierta. Reglas, en este orden:
 *   1. Solo el dueño (autorización a nivel de objeto).
 *   2. Solo modalidad ambulante (409): un puesto o local no se mueve.
 *   3. Consentimiento 'ubicacion_en_vivo' ya otorgado (403
 *      consent-required con missingConsentTypes: ['live_location']).
 *   4. Dentro de su horario o de una franja AHORA (409 con type
 *      live-location-off-schedule): así se "apaga" sola al terminar el
 *      horario, sin cron — mismo mecanismo que las franjas.
 */
async function registrar(usuarioId, negocioId, { latitude, longitude }) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  if (negocio.movilidad !== 'ambulante') {
    throw new ConflictError('Solo un negocio ambulante puede compartir su ubicación en vivo');
  }

  const consintio = await consentimientosRepo.existeConsentimiento(usuarioId, 'ubicacion_en_vivo');
  if (!consintio) {
    throw new ConsentRequiredError(
      ['live_location'],
      'Debes aceptar compartir tu ubicación en vivo antes de activarla',
    );
  }

  if (!(await posicionesRepo.estaEnHorarioOFranja(negocioId))) {
    throw new ConflictError(
      'Tu horario de hoy ya terminó — la ubicación en vivo se apagó. Vuelve a activarla cuando abras.',
      TIPO_FUERA_DE_HORARIO,
    );
  }

  const saved = await posicionesRepo.registrar({ negocioId, latitud: latitude, longitud: longitude });
  return { saved };
}

/** DELETE /businesses/{businessId}/live-location — apagar a mano: borra el rastro en el acto. */
async function apagar(usuarioId, negocioId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);
  await posicionesRepo.borrarDeNegocio(negocioId);
}

module.exports = { registrar, apagar, TIPO_FUERA_DE_HORARIO };
