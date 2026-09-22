const { z } = require('zod');

// Sin consentimientos acá (a diferencia de loginSchema en
// auth.validators.js) — RF-018/Ley 1581 no le aplica a una cuenta de
// administrador de la plataforma.
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const adminLogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = { adminLoginSchema, adminRefreshSchema, adminLogoutSchema };
