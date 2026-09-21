const { z } = require('zod');

const productInputSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  // productos.precio es DECIMAL(10,2) en schema.sql (CHECK precio >= 0) —
  // el máximo no es arbitrario, es el rango real de la columna.
  price: z.coerce.number().min(0).max(99999999.99),
  // categorias.id es SMALLINT — mismo límite que categoryId en
  // business.validators.js. Nullable porque productos.categoria_id lo es.
  categoryId: z.coerce.number().int().positive().max(32767).nullable().optional(),
  // Sin .default(true) a propósito: este mismo schema se reusa en PATCH
  // (mismo patrón que businessInputSchema), donde productos.service.js
  // necesita distinguir "el cliente no mandó available" (conservar el
  // valor actual) de "el cliente mandó available: true" — con .default()
  // zod rellena el campo antes de que el service lo vea, así que un PATCH
  // que solo cambia el precio reactivaba en silencio un producto marcado
  // como agotado. El valor por defecto en creación (true) se aplica en
  // productos.service.js, no aquí.
  available: z.coerce.boolean().optional(),
  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
  // ver CLAUDE.md, migración productos-tipo-oferta. tipos_oferta.id es
  // SERIAL (entero normal, no SMALLINT) — a diferencia de categoryId
  // (categorias.id es SMALLSERIAL), sin el mismo tope de 32767. Mismo
  // criterio "sin .default(), undefined conserva el valor existente en
  // PATCH" que categoryId/available: un producto de catálogo normal deja
  // los tres campos de oferta en null (ni siquiera se mandan).
  offerTypeId: z.coerce.number().int().positive().nullable().optional(),
  // z.coerce.date() acepta cualquier string ISO 8601 que Date() reconozca
  // — el frontend ya resuelve los atajos ("solo hoy"/"este mes"/
  // "personalizado") a fechas concretas antes de mandarlas; el backend
  // solo valida que sean fechas válidas y que el rango tenga sentido (ver
  // .refine() más abajo).
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
})
  .refine(
    (data) =>
      !data.validFrom || !data.validUntil || data.validUntil.getTime() > data.validFrom.getTime(),
    { message: 'validUntil debe ser posterior a validFrom', path: ['validUntil'] },
  );

module.exports = { productInputSchema };
