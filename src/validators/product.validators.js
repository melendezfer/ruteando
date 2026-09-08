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
  available: z.coerce.boolean().default(true),
});

module.exports = { productInputSchema };
