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
});

module.exports = { productInputSchema };
