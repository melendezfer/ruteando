const consentimientosRepo = require('../repositories/consentimientos.repository');
const { UnauthorizedError } = require('../errors');

// ConsentInput.type (openapi.yaml) usa inglés; tipo_consentimiento
// (schema.sql) usa español — mismo principio que eventos.service.js. Vive
// acá y no en business.mapper.js porque consentimiento no es dominio de
// negocio.
const TIPO_CONSENTIMIENTO_API_TO_DB = {
  data_processing: 'tratamiento_datos',
  terms_conditions: 'terminos_condiciones',
  assisted_registration: 'registro_asistido',
  notifications: 'notificaciones',
};

const TIPO_CONSENTIMIENTO_DB_TO_API = Object.fromEntries(
  Object.entries(TIPO_CONSENTIMIENTO_API_TO_DB).map(([api, db]) => [db, api]),
);

// RF-018: los dos tipos que "completan" el registro de un usuario (ver
// CLAUDE.md sección 4). En vocabulario API (inglés) porque es lo que
// ConsentRequiredError#missingConsentTypes expone al cliente.
const TIPOS_OBLIGATORIOS_API = ['data_processing', 'terms_conditions'];

function toApiConsent(row) {
  return {
    id: row.id,
    type: TIPO_CONSENTIMIENTO_DB_TO_API[row.tipo],
    businessId: row.negocio_id,
    textVersion: row.texto_version,
    grantedByThirdParty: row.otorgado_por_terceros,
    userId: row.usuario_id,
    grantedAt: row.fecha_otorgado,
  };
}

/**
 * POST /consents. actorUserId es req.user?.id ?? null (viene de
 * tryAuthenticate, que nunca rechaza la petición él mismo). El
 * consentimiento siempre se asocia a quien hace la solicitud — no hay
 * forma de otorgarlo a nombre de otro usuario_id todavía (eso es
 * registro asistido, RF-018 lo prevé pero queda pendiente para cuando se
 * aborde la Épica 2, ver gaps conocidos).
 */
async function crear({ actorUserId, body, ip }) {
  if (!actorUserId) {
    // El camino sin token existe en la ruta (tryAuthenticate nunca
    // rechaza por sí solo) para dejar espacio al registro asistido
    // futuro, pero esa lógica de negocio no está implementada — por
    // ahora, sin usuario autenticado no hay a quién asociar el
    // consentimiento.
    throw new UnauthorizedError('Se requiere autenticación para registrar un consentimiento');
  }

  const consentimiento = await consentimientosRepo.crear({
    usuarioId: actorUserId,
    negocioId: body.businessId,
    tipo: TIPO_CONSENTIMIENTO_API_TO_DB[body.type],
    otorgadoPorTerceros: body.grantedByThirdParty ?? false,
    textoVersion: body.textVersion,
    ip,
  });

  return toApiConsent(consentimiento);
}

async function listar(usuarioId) {
  const filas = await consentimientosRepo.listarPorUsuario(usuarioId);
  return filas.map(toApiConsent);
}

/**
 * Usada por auth.service.js en login()/refresh(), antes de emitir
 * tokens. Devuelve los tipos obligatorios (vocabulario API) que a este
 * usuario todavía le faltan — arreglo vacío si ya otorgó los dos.
 */
async function obtenerTiposObligatoriosFaltantes(usuarioId) {
  const otorgadosDb = await consentimientosRepo.tiposObligatoriosOtorgados(usuarioId);
  const otorgadosApi = new Set(otorgadosDb.map((tipo) => TIPO_CONSENTIMIENTO_DB_TO_API[tipo]));
  return TIPOS_OBLIGATORIOS_API.filter((tipo) => !otorgadosApi.has(tipo));
}

module.exports = { crear, listar, obtenerTiposObligatoriosFaltantes };
