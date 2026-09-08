const { z } = require('zod');

const consentInputSchema = z.object({
  type: z.enum(['data_processing', 'terms_conditions', 'assisted_registration', 'notifications']),
  businessId: z.string().uuid().nullable().optional(),
  // consentimientos.texto_version es VARCHAR(20) — el límite no es
  // arbitrario, es el rango real de la columna (mismo criterio que el
  // resto de los validators de este proyecto).
  textVersion: z.string().min(1).max(20),
  grantedByThirdParty: z.coerce.boolean().default(false),
});

module.exports = { consentInputSchema };
