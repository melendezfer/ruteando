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
  .refine((data) => data.closed || data.openTime < data.closeTime, {
    message: 'closeTime debe ser posterior a openTime',
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

module.exports = {
  businessInputSchema,
  locationInputSchema,
  scheduleInputSchema,
  reportInputSchema,
};
