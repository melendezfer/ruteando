const eventosRepo = require('../repositories/eventos.repository');
const negociosRepo = require('../repositories/negocios.repository');
const { TooManyRequestsError } = require('../errors');
const { EVENT_RATE_LIMIT_MAX, EVENT_RATE_LIMIT_WINDOW_MINUTES } = require('../config/constants');

// EventInput.type (openapi.yaml) usa inglés; tipo_evento (schema.sql) usa
// español — mismo principio que business.mapper.js para negocios.
const TIPO_EVENTO_API_TO_DB = {
  search: 'busqueda',
  business_view: 'vista_negocio',
  product_view: 'vista_producto',
  contact_click: 'clic_contacto',
  favorite_added: 'favorito_agregado',
  review_created: 'resena_creada',
  business_registered: 'registro_negocio',
};

async function crear({ usuarioId, ip, type, businessId, metadata }) {
  const recientes = await eventosRepo.contarRecientesDelOrigen({
    usuarioId,
    ip,
    windowMinutes: EVENT_RATE_LIMIT_WINDOW_MINUTES,
  });

  if (recientes >= EVENT_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError(
      `Demasiados eventos desde este origen (máximo ${EVENT_RATE_LIMIT_MAX} por ${EVENT_RATE_LIMIT_WINDOW_MINUTES} min)`,
    );
  }

  // businessId con forma válida pero que no corresponde a ningún negocio
  // real no debe tumbar la solicitud (analítica de mejor esfuerzo, ver
  // eventos.validators.js) — se guarda como negocio_id null en vez de
  // fallar con 404, igual que el propio schema de "eventos" ya tolera
  // negocio_id null quedando huérfano cuando un negocio se borra
  // (ON DELETE SET NULL).
  let negocioId = null;
  if (businessId) {
    const negocio = await negociosRepo.buscarPorId(businessId);
    negocioId = negocio ? businessId : null;
  }

  await eventosRepo.crear({
    usuarioId,
    negocioId,
    tipo: TIPO_EVENTO_API_TO_DB[type],
    metadatos: metadata ?? null,
    ip,
  });
}

module.exports = { crear };
