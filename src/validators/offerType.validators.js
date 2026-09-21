const { z } = require('zod');

// Reusado por POST /admin/offer-types y PATCH /admin/offer-types/{id} —
// mismo criterio que businessInputSchema/productInputSchema: `name` es
// obligatorio en los dos verbos (un PATCH vuelve a mandarlo), el resto es
// opcional y sin `.default()` a propósito, para que
// tiposOferta.service.js pueda distinguir "no lo mandó" (conservar el
// valor existente en un PATCH) de "lo mandó explícito" — el valor por
// defecto de creación (displayOrder: 0, active: true) se aplica en el
// service, no acá.
const offerTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().max(50).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).max(32767).optional(),
  active: z.boolean().optional(),
});

module.exports = { offerTypeInputSchema };
