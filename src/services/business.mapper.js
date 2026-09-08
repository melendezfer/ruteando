// Mismo principio que user.mapper.js: la base de datos usa los enums en
// español del Documento 07, el contrato de openapi.yaml usa inglés. Este
// es el único lugar que conoce ambos vocabularios para negocios,
// ubicaciones, horarios, productos y fotos.

const STATUS_DB_TO_API = {
  pendiente: 'pending',
  activo: 'active',
  suspendido: 'suspended',
  cerrado: 'closed',
};

const LOCATION_TYPE_DB_TO_API = {
  fija: 'fixed',
  movil: 'mobile',
  puesto: 'stall',
  local: 'storefront',
  desde_casa: 'home',
  temporal: 'temporary',
};

const LOCATION_TYPE_API_TO_DB = Object.fromEntries(
  Object.entries(LOCATION_TYPE_DB_TO_API).map(([db, api]) => [api, db]),
);

const DAY_DB_TO_API = {
  lunes: 'monday',
  martes: 'tuesday',
  miercoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  sabado: 'saturday',
  domingo: 'sunday',
};

const DAY_API_TO_DB = Object.fromEntries(
  Object.entries(DAY_DB_TO_API).map(([db, api]) => [api, db]),
);

// Orden canónico lunes->domingo para que GET /schedule sea determinístico.
const ORDEN_DIAS_DB = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function toApiBusiness(row) {
  return {
    id: row.id,
    ownerId: row.usuario_id,
    categoryId: row.categoria_id,
    name: row.nombre,
    description: row.descripcion,
    status: STATUS_DB_TO_API[row.estado],
    contactPhone: row.telefono_contacto,
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
  };
}

function toApiLocation(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    type: LOCATION_TYPE_DB_TO_API[row.tipo],
    referenceAddress: row.direccion_referencia,
    latitude: row.latitud,
    longitude: row.longitud,
    isCurrent: row.es_actual,
    createdAt: row.fecha_creacion,
  };
}

// pg devuelve TIME como 'HH:MM:SS'; el contrato (openapi.yaml ScheduleDay)
// exige 'HH:MM'.
function truncarSegundos(hora) {
  return hora ? hora.slice(0, 5) : hora;
}

function toApiScheduleDay(row) {
  return {
    day: DAY_DB_TO_API[row.dia],
    openTime: truncarSegundos(row.hora_apertura),
    closeTime: truncarSegundos(row.hora_cierre),
    closed: row.cerrado,
  };
}

const PHOTO_TYPE_DB_TO_API = {
  negocio: 'business',
  producto: 'product',
};

function toApiProduct(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    categoryId: row.categoria_id,
    name: row.nombre,
    description: row.descripcion,
    // pg devuelve DECIMAL como string para no perder precisión — el
    // contrato (ProductInput/Product) lo declara number.
    price: Number(row.precio),
    available: row.disponible,
    createdAt: row.fecha_creacion,
  };
}

function toApiPhoto(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    productId: row.producto_id,
    type: PHOTO_TYPE_DB_TO_API[row.tipo],
    url: row.url,
    displayOrder: row.orden_visualizacion,
    createdAt: row.fecha_creacion,
  };
}

module.exports = {
  STATUS_DB_TO_API,
  LOCATION_TYPE_DB_TO_API,
  LOCATION_TYPE_API_TO_DB,
  DAY_DB_TO_API,
  DAY_API_TO_DB,
  ORDEN_DIAS_DB,
  PHOTO_TYPE_DB_TO_API,
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  toApiProduct,
  toApiPhoto,
};
