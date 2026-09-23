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

// Movilidad autodeclarada del negocio (petición directa del usuario, sin
// RF asociado — ver CLAUDE.md, migración movilidad-negocio): deliberadamente
// un vocabulario distinto de LOCATION_TYPE_DB_TO_API (que sí incluye
// 'mobile' como uno de sus 6 valores) — son dos campos separados con
// significados relacionados pero no iguales, ver la migración para el
// razonamiento completo de por qué no se reusó `ubicaciones.tipo`.
//
// 3 valores desde la migración modalidad-fijo-via-publica: 'fixed' sigue
// significando exactamente lo mismo que antes (local cerrado) para no
// romper a ningún cliente existente; el valor nuevo es 'street_stall'
// (puesto fijo en la vía pública — siempre en el mismo sitio, pero en la
// calle, no en un local).
const MOBILITY_DB_TO_API = {
  ambulante: 'itinerant',
  fijo_via_publica: 'street_stall',
  local_fijo: 'fixed',
};

const MOBILITY_API_TO_DB = Object.fromEntries(
  Object.entries(MOBILITY_DB_TO_API).map(([db, api]) => [api, db]),
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

// Búsqueda por texto (RF-010/011): distinguir si un negocio calificó por
// su propio nombre, por un producto de su catálogo, o por ambos a la
// vez (petición directa del usuario, sin RF asociado — ver CLAUDE.md).
// `row.nombre_coincide` (boolean o null) y `row.productos_coincidentes`
// (array o null) los calcula negocios.repository.js#listar/cercanos vía
// columnaNombreCoincide()/lateralProductosCoincidentes(), reusando el
// mismo placeholder de `q` ya ligado — este mapper solo traduce esas dos
// señales al contrato público, nunca recalcula el match en JS (regla de
// seguridad #1: la razón de la coincidencia se decide una sola vez, en
// la consulta que ya decidió si el negocio aparece).
//
// Devuelve `null` tanto sin `q` como cuando el negocio calificó por otra
// razón que no es nombre ni producto — desde la Fase 5 (búsqueda por
// familia, sección 50) eso es un caso real y esperado (matchType null +
// matchedCategory true), no solo "no se buscó por texto": antes de esa
// fase, la única forma de calificar con `q` presente era por nombre o
// producto, así que el `else` implícito nunca hacía falta distinguirlo
// (bug latente, nunca alcanzable hasta que existió una tercera vía).
function resolverMatchType(row) {
  if (row.nombre_coincide == null) return null;
  if (row.nombre_coincide && row.productos_coincidentes) return 'both';
  if (row.nombre_coincide) return 'business_name';
  if (row.productos_coincidentes) return 'product';
  return null;
}

// Forma liviana, no el Product completo (id/businessId/categoryId/etc.)
// — acá solo importa qué producto coincidió y su precio, para el modo
// "avanzado" de la búsqueda (mostrar el precio del ítem que hizo match),
// no un recurso completo que el cliente ya podría pedir aparte.
function toApiMatchedProduct(row) {
  return {
    name: row.nombre,
    price: Number(row.precio),
    available: row.disponible,
  };
}

// "Cerca de ti ahora" (sin RF asociado, petición directa del usuario —
// banner de descubrimiento): forma liviana de un producto con vigencia
// activa de ESTE negocio, mismo criterio que toApiMatchedProduct — acá
// además interesa qué tipo de oferta es (para el ícono) y hasta cuándo
// vale (para "cuánto le queda de vigencia").
function toApiActiveOffer(row) {
  return {
    name: row.nombre,
    price: Number(row.precio),
    available: row.disponible,
    offerTypeId: row.tipo_oferta_id ?? null,
    validUntil: row.vigencia_fin ?? null,
  };
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
    // Entrega a domicilio hecha por el propio vendedor (petición directa
    // del usuario, sin RF asociado — ver CLAUDE.md): la plataforma no
    // intermedia esa logística ni ese pago, solo lo muestra como
    // información declarada por el negocio. No es un dato sensible —
    // visible para cualquiera, igual que status/phoneVerified.
    ownDelivery: Boolean(row.entrega_propia),
    // Sello de higiene autodeclarada (petición directa del usuario, sin
    // RF asociado — ver CLAUDE.md). CUIDADO LEGAL: esto es una
    // AUTOdeclaración del vendedor, nunca una verificación de
    // cumplimiento hecha por RUTEANDO ni una certificación sanitaria
    // oficial — el texto exacto de la insignia pública (que deja esto
    // explícito) vive en el frontend (hygiene-badge.tsx), no acá; este
    // campo es solo el booleano crudo. No es un dato sensible: visible
    // para cualquiera, igual que status/phoneVerified/ownDelivery.
    hygieneSelfDeclared: Boolean(row.higiene_autodeclarada),
    // Movilidad autodeclarada — "ambulante" (se desplaza) vs. "local
    // fijo" (punto de venta fijo). Sin RF asociado, ver CLAUDE.md
    // (migración movilidad-negocio). Igual que ownDelivery/
    // hygieneSelfDeclared: no es un dato sensible, visible para
    // cualquiera. El mapa la usa para elegir la FORMA del pin (gota vs.
    // ícono distinto), nunca el color (eso sigue siendo por categoría).
    mobility: MOBILITY_DB_TO_API[row.movilidad],
    // Bancas/asientos disponibles (petición directa del usuario, sin RF
    // asociado — ver CLAUDE.md). Mismo criterio que ownDelivery/mobility:
    // no es un dato sensible, visible para cualquiera.
    seatingAvailable: Boolean(row.asientos_disponibles),
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
    // Por qué coincidió con `q` (ver resolverMatchType arriba) — null
    // salvo que la consulta que produjo esta fila haya buscado por texto
    // (listar/cercanos en negocios.repository.js con `q` presente).
    matchType: resolverMatchType(row),
    matchedProducts: row.productos_coincidentes
      ? row.productos_coincidentes.map(toApiMatchedProduct)
      : null,
    // "Cerca de ti ahora" (sin RF asociado, petición directa del usuario)
    // — los productos con vigencia activa de este negocio, solo cuando
    // la consulta que produjo esta fila pidió `hasActiveOffer=true`
    // (listar/cercanos en este archivo); en el resto de los callers
    // queda null, igual que matchedProducts/matchedOfferType.
    activeOffers: row.ofertas_vigentes ? row.ofertas_vigentes.map(toApiActiveOffer) : null,
    // Búsqueda por familia (Fase 5, sin RF asociado — ver CLAUDE.md
    // sección 50): el negocio calificó por su CATEGORÍA (nombre literal
    // o vía el diccionario de alias — "tintos" → "Tintos y café"), no
    // por su nombre ni por un producto. Independiente de `matchType` a
    // propósito, no un cuarto valor del enum: un negocio puede calificar
    // por nombre/producto Y por categoría a la vez, y una sola cadena no
    // alcanza para expresar esa combinación sin volverse una lista de
    // valores compuestos. El nombre de la categoría no viaja acá — el
    // cliente ya lo tiene vía `categoryId` + su propio catálogo de
    // categorías (GET /categories), no hace falta duplicarlo.
    matchedCategory: row.categoria_coincide ?? null,
    // Ofertas con vigencia (sin RF asociado — ver CLAUDE.md, migración
    // productos-tipo-oferta): si el negocio calificó para el filtro
    // `offerTypeId` (al menos un producto vigente de ese tipo) — mismo
    // patrón que matchedCategory, no un booleano que el cliente deba
    // recalcular. `null` cuando la consulta no filtró por `offerTypeId`;
    // cuando sí lo hizo, siempre es `true` para cada fila devuelta (el
    // propio WHERE ya exige esa condición para que el negocio aparezca)
    // — el campo existe igual para no obligar al cliente a inferirlo de
    // que el parámetro estaba presente en su propia petición.
    matchedOfferType: row.oferta_coincide ?? null,
    // Confirmación de disponibilidad en tiempo real (sección 11 de
    // CLAUDE.md) — mismo criterio que latitude/longitude/distanceMeters
    // arriba: solo viene lleno cuando la consulta que produjo esta fila
    // hizo el LEFT JOIN LATERAL contra solicitudes_disponibilidad
    // (listar/cercanos en negocios.repository.js); en el resto de los
    // callers (crear/actualizar/buscarPorId sin ese join) queda null.
    // toApiBusinessProfile la sobrescribe después del spread con el valor
    // que ya calculaba aparte (obtenerConfirmacionFresca) — sin cambios
    // ahí. Decisión B (petición directa del usuario): esto es solo una
    // insignia informativa, nunca filtra ni oculta ningún resultado.
    availabilityConfirmedAt: row.disponibilidad_confirmada_en ?? null,
    // RF-020 (Épica 9): motivo que un administrador escribió al rechazar
    // el negocio (columna motivo_rechazo, ver migración
    // estado-negocio-rechazado) — es la única forma de que el vendedor
    // dueño sepa qué corregir, así que se expone en la respuesta en vez
    // de quedar solo en el log. null salvo que el negocio esté
    // 'rechazado' (o haya estado en algún momento y luego se haya vuelto
    // a aprobar, ver negocios.repository.js#aprobar, que lo limpia).
    rejectionReason: row.motivo_rechazo ?? null,
    // Franja del día vigente AHORA de un vendedor ambulante (migración
    // franjas-ubicacion-ambulante) — cuando no es null, `latitude`/
    // `longitude`/`distanceMeters` de esta misma fila ya son los de la
    // franja, no los de la ubicación base (ver
    // negocios.repository.js#lateralFranjaActiva). Solo viene lleno en
    // listar/cercanos (que hacen ese join) y en el perfil
    // (toApiBusinessProfile lo sobrescribe con su propia consulta).
    activeLocationSlot: row.franja_id != null ? toApiActiveLocationSlot({
      id: row.franja_id,
      hora_inicio: row.franja_hora_inicio,
      hora_fin: row.franja_hora_fin,
      direccion_referencia: row.franja_direccion_referencia,
    }) : null,
  };
}

/** Resumen de la franja vigente — sin coordenadas: esas ya viajan como la ubicación efectiva del negocio. */
function toApiActiveLocationSlot(row) {
  return {
    id: Number(row.id),
    startTime: truncarSegundos(row.hora_inicio),
    endTime: truncarSegundos(row.hora_fin),
    referenceAddress: row.direccion_referencia ?? null,
  };
}

/**
 * Franja completa (GET/PUT /businesses/{businessId}/location-slots).
 * Misma regla de privacidad que toApiLocation: el público ve la
 * coordenada aproximada si el negocio eligió "zona aproximada"
 * (`ubicaciones.mostrar_ubicacion_exacta`, la preferencia vale para toda
 * ubicación del negocio, base o franja); el dueño siempre la exacta.
 */
function toApiLocationSlot(row, { mostrarExacta }) {
  const latitud = Number(row.latitud);
  const longitud = Number(row.longitud);
  return {
    id: Number(row.id),
    day: DAY_DB_TO_API[row.dia],
    startTime: truncarSegundos(row.hora_inicio),
    endTime: truncarSegundos(row.hora_fin),
    latitude: mostrarExacta ? latitud : aproximarCoordenada(latitud),
    longitude: mostrarExacta ? longitud : aproximarCoordenada(longitud),
    referenceAddress: row.direccion_referencia ?? null,
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
    // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado
    // — ver CLAUDE.md, migración productos-tipo-oferta. Los tres quedan
    // null para un producto de catálogo normal (el caso de siempre, sin
    // cambios de comportamiento).
    offerTypeId: row.tipo_oferta_id ?? null,
    validFrom: row.vigencia_inicio ?? null,
    validUntil: row.vigencia_fin ?? null,
    updatedAt: row.fecha_actualizacion,
    // Sin RF asociado, petición directa del usuario (ver CLAUDE.md):
    // desde cuándo `available` tiene su valor actual — a diferencia de
    // `updatedAt` (que se mueve con CUALQUIER edición del producto:
    // precio, nombre, descripción...), esta columna solo se mueve cuando
    // `disponible` de verdad cambia de valor (ver
    // productos.repository.js#actualizar). En la creación, coincide con
    // `createdAt` — es el primer valor que tuvo.
    availabilityUpdatedAt: row.disponibilidad_actualizada_en,
  };
}

const MODERATION_STATUS_DB_TO_API = {
  pendiente: 'pending',
  aprobada: 'approved',
  rechazada: 'rejected',
};

// Catálogo de etiquetas rápidas de reseñas (petición directa del
// usuario, sin RF asociado — ver CLAUDE.md, "retroalimentación privada").
// Corto a propósito y sin pretender ser exhaustivo: cubre lo más común
// en cada rubro, no cada posible matiz. Ampliado en la expansión a
// comercio no gastronómico (sección 31/32 de CLAUDE.md): las primeras 4
// son genéricas (cualquier tipo de negocio); las siguientes se
// muestran solo para el tipo de categoría que corresponde — ver
// client/src/lib/reviews/review-tags.ts, el único lugar del frontend
// que decide cuáles chips mostrar según Category.type.
const REVIEW_TAG_DB_TO_API = {
  // Genéricas — cualquier tipo de negocio.
  buen_trato: 'good_service',
  espera_larga: 'long_wait',
  buen_precio: 'good_price',
  precio_alto: 'high_price',
  // Solo `alimentos`.
  comida_caliente: 'hot_food',
  comida_fria: 'cold_food',
  buena_presentacion: 'good_presentation',
  poca_cantidad: 'small_portion',
  // Solo `productos` (bienes no gastronómicos, ej. artesanías) —
  // buena_presentacion (arriba) también aplica acá, se reusa.
  buena_calidad: 'good_quality',
  mala_calidad: 'poor_quality',
  no_como_se_esperaba: 'not_as_described',
  // Solo `servicios` (ej. costura/sastrería, asesoría legal básica).
  buen_asesoramiento: 'knowledgeable',
  no_resolvio_problema: 'did_not_solve_problem',
  puntual: 'punctual',
  impuntual: 'late',
};

const REVIEW_TAG_API_TO_DB = Object.fromEntries(
  Object.entries(REVIEW_TAG_DB_TO_API).map(([db, api]) => [api, db]),
);

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
    tags: (row.etiquetas ?? []).map((etiqueta) => REVIEW_TAG_DB_TO_API[etiqueta]),
    privateComment: row.comentario_privado,
    moderationStatus: MODERATION_STATUS_DB_TO_API[row.estado_moderacion],
    createdAt: row.fecha_creacion,
  };
}

/**
 * GET /businesses/{businessId}/feedback — retroalimentación privada que
 * ve el dueño del negocio (ver resenas.service.js#listarFeedbackPrivado).
 * A propósito una forma DISTINTA de toApiReview, no la misma función con
 * un flag: sin businessId/userId en la forma misma, es estructuralmente
 * imposible filtrar de vuelta a quién escribió cada aporte, en vez de
 * confiar en que cada llamador recuerde omitir esos campos.
 */
function toApiReviewFeedback(row) {
  return {
    id: row.id,
    rating: row.calificacion,
    tags: (row.etiquetas ?? []).map((etiqueta) => REVIEW_TAG_DB_TO_API[etiqueta]),
    privateComment: row.comentario_privado,
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
  franjaActiva,
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
    // Ver toApiBusiness#activeLocationSlot. En el perfil, `location` sigue
    // siendo la ubicación BASE (la que edita el dueño); dónde está el
    // ambulante ahora mismo, si está en una franja, lo dice este campo.
    activeLocationSlot: franjaActiva ? toApiActiveLocationSlot(franjaActiva) : null,
  };
}

module.exports = {
  STATUS_DB_TO_API,
  LOCATION_TYPE_DB_TO_API,
  LOCATION_TYPE_API_TO_DB,
  MOBILITY_DB_TO_API,
  MOBILITY_API_TO_DB,
  DAY_DB_TO_API,
  DAY_API_TO_DB,
  ORDEN_DIAS_DB,
  PHOTO_TYPE_DB_TO_API,
  MODERATION_STATUS_DB_TO_API,
  REVIEW_TAG_DB_TO_API,
  REVIEW_TAG_API_TO_DB,
  aproximarCoordenada,
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  toApiLocationSlot,
  toApiProduct,
  toApiPhoto,
  toApiReview,
  toApiReviewFeedback,
  toApiBusinessProfile,
};
