const { z } = require('zod');

const registerSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['consumer', 'vendor']),
});

// RF-018: opcional — solo viaja cuando el cliente reintenta un login que
// acaba de recibir 403 (ConsentRequiredProblem) con los consentimientos
// que el usuario aceptó en ese momento (ver
// auth.service.js#exigirOConcederConsentimiento). Máximo los dos tipos
// obligatorios; un tercero no tiene sentido acá.
const loginConsentSchema = z.object({
  type: z.enum(['data_processing', 'terms_conditions']),
  textVersion: z.string().min(1).max(20),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  consents: z.array(loginConsentSchema).max(2).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
