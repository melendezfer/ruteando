const { z } = require('zod');
const { businessInputSchema } = require('./business.validators');

// Anidado (vendor/business) a propósito: vendor.fullName vs business.name
// chocarían si se aplanara todo en un solo objeto. business reusa
// businessInputSchema tal cual — mismas reglas que POST /businesses, sin
// duplicarlas.
const assistedRegistrationInputSchema = z.object({
  vendor: z.object({
    fullName: z.string().min(1).max(150),
    // Ambos opcionales a propósito (RF-018): el vendedor asistido puede no
    // tener ninguno de los dos todavía — ver migración
    // usuarios-registro-asistido, que quitó el NOT NULL de usuarios.correo.
    email: z.string().email().nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
  }),
  business: businessInputSchema,
  // consentimientos.texto_version es VARCHAR(20) — mismo límite real que
  // consentimientos.validators.js.
  consentTextVersion: z.string().min(1).max(20),
});

const claimAssistedAccountSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

module.exports = { assistedRegistrationInputSchema, claimAssistedAccountSchema };
