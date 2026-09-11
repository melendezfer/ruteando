// Mismo principio que user.mapper.js: la base de datos usa los enums en
// español del Documento 07, el contrato de openapi.yaml usa inglés. Este
// es el único lugar que conoce ambos vocabularios para negocios,
// ubicaciones, horarios, productos y fotos.

const STATUS_DB_TO_API = {
  pendiente: 'pending',
  activo: 'active',
  suspendido: 'suspended',
  cerrado: 'closed',
  // Épica 9 (RF-020): valor nuevo del enum estado_negocio (ver migración
  // estado-negocio-rechazado) — distinto de 'closed', que sigue siendo
  // solo "estuvo activo y se cerró después".
  rechazado: 'rejected',
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

// "Mostrar mi dirección exacta" vs. "Mostrar solo la zona aproximada"
// (petición del usuario, sin RF asociado — ver CLAUDE.md): 3 decimales
// ≈ 111m en el ecuador (y similar en la latitud de Cundinamarca), del
// orden de una manzana/conjunto — ni el punto exacto (protege el
// objetivo: no exponer "el apartamento") ni tan burdo que dificulte de
// verdad encontrar la zona. Redondeo determinístico (no un offset
// aleatorio): el mismo negocio siempre aproxima al mismo punto, así el
// pin no "salta" entre pedidos distintos del mismo perfil.
//
// Límite reconocido, no oculto: esto redondea la COORDENADA mostrada,
// no la distancia calculada en /businesses/nearby (que sigue siendo
// exacta, es la utilidad real de la búsqueda) ni el texto libre de
// referenceAddress — si el vendedor escribe el número de apartamento
// ahí, esta función no puede detectarlo ni redactarlo (ver el aviso en
// el formulario del cliente). Alguien que consulte la distancia exacta
// desde varios puntos de referencia distintos podría, en teoría,
// triangular una posición más precisa que la mostrada — igual que
// cualquier app que aproxima un pin pero no la distancia; no se intenta
// resolver ese caso acá.
const APROXIMACION_COORDENADA_DECIMALES = 3;

function aproximarCoordenada(valor) {
  if (valor == null) return valor;
  const factor = 10 ** APROXIMACION_COORDENADA_DECIMALES;
  return Math.round(Number(valor) * factor) / factor;
}

function toApiBusiness(row) {
  return {
    id: row.id,
    ownerId: row.usuario_id,
    categoryId: row.categoria_id,
    name: row.nombre,
    description: row.descripcion,
    status: STATUS_DB_TO_API[row.estado],
    contactPhone: row.telefono_contacto,
    // Verificación de teléfono de vendedores (ver CLAUDE.md) — no es un
    // dato sensible que haya que ocultar del dueño (a diferencia de
    // rejectionReason): cualquiera puede ver si un negocio ya verificó
    // su teléfono o no.
    phoneVerified: Boolean(row.telefono_verificado),
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
    // Presentes solo cuando la consulta que produjo esta fila hizo el
    // join con ubicaciones (listar/cercanos en negocios.repository.js) —
    // en el resto de los callers (crear/obtener/actualizar/cerrar) quedan
    // en null, no es un dato que esos endpoints hayan consultado.
    //
    // GET /businesses y /businesses/nearby son públicos, sin ningún
    // concepto de "quien pregunta" (a diferencia de
    // GET /businesses/{id}) — acá `mostrar_ubicacion_exacta` es la única
    // señal que importa, siempre: nunca la coordenada real si el negocio
    // eligió "zona aproximada".
    latitude:
      row.latitud != null
        ? row.mostrar_ubicacion_exacta
          ? Number(row.latitud)
          : aproximarCoordenada(Number(row.latitud))
        : null,
    longitude:
      row.longitud != null
        ? row.mostrar_ubicacion_exacta
          ? Number(row.longitud)
          : aproximarCoordenada(Number(row.longitud))
        : null,
    // Solo lo llena la consulta de /businesses/nearby.
    distanceMeters: row.distancia_m != null ? Number(row.distancia_m) : null,
    // RF-020 (Épica 9): motivo que un administrador escribió al rechazar
    // el negocio (columna motivo_rechazo, ver migración
    // estado-negocio-rechazado) — es la única forma de que el vendedor
    // dueño sepa qué corregir, así que se expone en la respuesta en vez
    // de quedar solo en el log. null salvo que el negocio esté
    // 'rechazado' (o haya estado en algún momento y luego se haya vuelto
    // a aprobar, ver negocios.repository.js#aprobar, que lo limpia).
    rejectionReason: row.motivo_rechazo ?? null,
  };
}

/**
 * requesterIsOwner: el dueño del negocio (o cualquier caller ya
 * autorizado como tal, ej. justo después de PUT/PATCH) siempre ve la
 * coordenada real, sin importar `mostrar_ubicacion_exacta` — esa
 * preferencia es sobre qué ve el público, nunca sobre qué ve el propio
 * dueño de su propia ubicación (ver CLAUDE.md).
 */
function toApiLocation(row, { requesterIsOwner = false } = {}) {
  const mostrarExacta = requesterIsOwner || Boolean(row.mostrar_ubicacion_exacta);
  return {
    id: row.id,
    businessId: row.negocio_id,
    type: LOCATION_TYPE_DB_TO_API[row.tipo],
    referenceAddress: row.direccion_referencia,
    latitude: mostrarExacta ? row.latitud : aproximarCoordenada(row.latitud),
    longitude: mostrarExacta ? row.longitud : aproximarCoordenada(row.longitud),
    isCurrent: row.es_actual,
    createdAt: row.fecha_creacion,
    // El interruptor en sí (no es un dato sensible — a diferencia de la
    // coordenada, "este vendedor eligió ocultar su dirección exacta" no
    // expone nada de él) — así el frontend puede dibujar el estado
    // correcto del interruptor sin necesitar ser el dueño para saberlo.
    showExactLocation: Boolean(row.mostrar_ubicacion_exacta),
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

const MODERATION_STATUS_DB_TO_API = {
  pendiente: 'pending',
  aprobada: 'approved',
  rechazada: 'rejected',
};

function toApiPhoto(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    productId: row.producto_id,
    type: PHOTO_TYPE_DB_TO_API[row.tipo],
    url: row.url,
    displayOrder: row.orden_visualizacion,
    createdAt: row.fecha_creacion,
    // Épica 9: null en callers que no seleccionan la columna (no aplica
    // hoy, todos usan SELECT */RETURNING *) — presente siempre desde la
    // migración fotos-moderacion.
    moderationStatus: row.estado_moderacion
      ? MODERATION_STATUS_DB_TO_API[row.estado_moderacion]
      : null,
  };
}

function toApiReview(row) {
  return {
    id: row.id,
    businessId: row.negocio_id,
    userId: row.usuario_id,
    rating: row.calificacion,
    comment: row.comentario,
    moderationStatus: MODERATION_STATUS_DB_TO_API[row.estado_moderacion],
    createdAt: row.fecha_creacion,
  };
}

/**
 * GET /businesses/{businessId} (RF-012) — perfil público completo.
 * Distinto de toApiBusiness (usado en crear/listar/cercanos): ahí
 * embeber menú/fotos/horario en cada resultado de una búsqueda sería
 * desperdiciar ancho de banda; acá es exactamente lo que pide el
 * contrato para un solo negocio. Las reseñas mismas NO se embeben (sin
 * límite de cuántas puede haber) — solo el agregado; la lista completa
 * vive en su propio endpoint paginado (GET .../reviews, Épica 6).
 *
 * esPropietario sobrescribe el rejectionReason que ya trae toApiBusiness(negocio)
 * — este endpoint es público (sin auth obligatoria), así que el motivo de
 * rechazo (RF-020) solo debe verse cuando quien pregunta está autenticado
 * y es el dueño del negocio (autorización a nivel de objeto, regla de
 * seguridad #2); para cualquier otro caso (anónimo, otro usuario) queda en
 * null, sin importar lo que tenga la fila.
 */
function toApiBusinessProfile({
  negocio,
  ubicacion,
  horario,
  productos,
  fotos,
  agregadoResenas,
  esPropietario,
  availabilityConfirmedAt,
  isOpenNow,
}) {
  return {
    ...toApiBusiness(negocio),
    rejectionReason: esPropietario ? (negocio.motivo_rechazo ?? null) : null,
    location: ubicacion ? toApiLocation(ubicacion, { requesterIsOwner: esPropietario }) : null,
    schedule: horario.map(toApiScheduleDay),
    products: productos.map(toApiProduct),
    photos: fotos.map(toApiPhoto),
    averageRating: agregadoResenas.promedio,
    reviewCount: agregadoResenas.total,
    // Confirmación de disponibilidad en tiempo real (sección 11 de
    // CLAUDE.md) — null salvo que exista una confirmación todavía fresca
    // (ver solicitudesDisponibilidad.repository.js#obtenerConfirmacionFresca).
    availabilityConfirmedAt: availabilityConfirmedAt ?? null,
    // "Abierto ahora" (Épica F4 del frontend) — calculado acá contra
    // `schedule` en el mismo instante de la petición, nunca cacheado ni
    // recalculado en el cliente.
    isOpenNow: Boolean(isOpenNow),
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
  MODERATION_STATUS_DB_TO_API,
  aproximarCoordenada,
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  toApiProduct,
  toApiPhoto,
  toApiReview,
  toApiBusinessProfile,
};
