const { z } = require('zod');

const businessInputSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  // categorias.id es SMALLSERIAL (smallint) en schema.sql — el límite no
  // es arbitrario, es el rango real de la columna.
  categoryId: z.coerce.number().int().positive().max(32767),
  contactPhone: z.string().max(20).nullable().optional(),
});

// Caja envolvente de Cundinamarca (regla de seguridad #6: "idealmente un
// chequeo de que caen dentro de un rango razonable para
// Soacha/Cundinamarca"). Generosa a propósito — cubre todo el
// departamento, no solo el municipio, para no rechazar casos válidos en
// el borde.
const CUNDINAMARCA_BBOX = { latMin: 3.5, latMax: 6.0, lonMin: -75.5, lonMax: -73.0 };

const locationInputSchema = z
  .object({
    type: z.enum(['fixed', 'mobile', 'stall', 'storefront', 'home', 'temporary']),
    referenceAddress: z.string().max(255).optional(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  })
  .refine(
    (data) =>
      data.latitude >= CUNDINAMARCA_BBOX.latMin &&
      data.latitude <= CUNDINAMARCA_BBOX.latMax &&
      data.longitude >= CUNDINAMARCA_BBOX.lonMin &&
      data.longitude <= CUNDINAMARCA_BBOX.lonMax,
    {
      message: 'Las coordenadas están fuera del rango esperado para Cundinamarca',
      path: ['latitude'],
    },
  );

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleDaySchema = z
  .object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    openTime: z.string().regex(TIME_PATTERN).nullable().optional(),
    closeTime: z.string().regex(TIME_PATTERN).nullable().optional(),
    closed: z.boolean().default(false),
  })
  .refine((data) => data.closed || (data.openTime && data.closeTime), {
    message: 'openTime y closeTime son obligatorios cuando closed es false',
    path: ['openTime'],
  })
  // closeTime < openTime está permitido a propósito: es un turno nocturno
  // que cruza medianoche (ej. 18:00–02:00, común en comida callejera
  // nocturna) — ver disponibilidad.service.js, que interpreta ese caso al
  // calcular "abierto ahora". Solo se rechaza la igualdad exacta: es
  // ambigua (¿"cerrado todo el día" o "abierto 24 horas"?) y este esquema
  // no tiene forma de distinguir esos dos casos — usa closed:true para el
  // primero; "abierto 24 horas" no es representable hoy.
  .refine((data) => data.closed || data.openTime !== data.closeTime, {
    message:
      'closeTime no puede ser igual a openTime (usa closed:true para "cerrado todo el día"; "abierto 24 horas" no es representable en este esquema)',
    path: ['closeTime'],
  });

const scheduleInputSchema = z
  .array(scheduleDaySchema)
  .max(7)
  .refine((dias) => new Set(dias.map((d) => d.day)).size === dias.length, {
    message: 'No puede haber dos horarios para el mismo día',
  });

const reportInputSchema = z.object({
  reason: z.string().min(1).max(500),
});

// Filtros combinables de RF-010/011, compartidos por GET /businesses y
// GET /businesses/nearby (ver negocios.repository.js#agregarFiltrosComunes).
// query params siempre llegan como string — z.coerce.boolean() NO sirve
// para openNow porque Boolean("false") es true (coerciona cualquier
// string no vacío); por eso el enum explícito.
const filtrosNegociosShape = {
  categoryId: z.coerce.number().int().positive().max(32767).optional(),
  q: z.string().trim().min(1).max(150).optional(),
  priceMin: z.coerce.number().min(0).max(99999999.99).optional(),
  priceMax: z.coerce.number().min(0).max(99999999.99).optional(),
  openNow: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

const RANGO_PRECIO_REFINE = (data) =>
  data.priceMin == null || data.priceMax == null || data.priceMin <= data.priceMax;
const RANGO_PRECIO_MENSAJE = {
  message: 'priceMin no puede ser mayor que priceMax',
  path: ['priceMin'],
};

const businessListQuerySchema = z
  .object(filtrosNegociosShape)
  .refine(RANGO_PRECIO_REFINE, RANGO_PRECIO_MENSAJE);

const businessNearbyQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(10).default(2),
    ...filtrosNegociosShape,
  })
  .refine(
    (data) =>
      data.lat >= CUNDINAMARCA_BBOX.latMin &&
      data.lat <= CUNDINAMARCA_BBOX.latMax &&
      data.lng >= CUNDINAMARCA_BBOX.lonMin &&
      data.lng <= CUNDINAMARCA_BBOX.lonMax,
    { message: 'Las coordenadas están fuera del rango esperado para Cundinamarca', path: ['lat'] },
  )
  .refine(RANGO_PRECIO_REFINE, RANGO_PRECIO_MENSAJE);

module.exports = {
  businessInputSchema,
  locationInputSchema,
  scheduleInputSchema,
  reportInputSchema,
  businessListQuerySchema,
  businessNearbyQuerySchema,
};
