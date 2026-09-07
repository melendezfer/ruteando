const path = require('node:path');
const { z } = require('zod');

require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
  quiet: true,
});

// Nombres y significado exactos: Documento 14, sección 1.4.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),

    STORAGE_ENDPOINT: z.string().min(1, 'STORAGE_ENDPOINT es obligatorio'),
    STORAGE_BUCKET: z.string().min(1, 'STORAGE_BUCKET es obligatorio'),
    STORAGE_ACCESS_KEY: z.string().min(1, 'STORAGE_ACCESS_KEY es obligatorio'),
    STORAGE_SECRET_KEY: z.string().min(1, 'STORAGE_SECRET_KEY es obligatorio'),

    SENTRY_DSN: z.string().optional(),

    CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN es obligatorio'),

    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  })
  .refine((data) => data.JWT_ACCESS_SECRET !== data.JWT_REFRESH_SECRET, {
    message: 'JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET',
    path: ['JWT_REFRESH_SECRET'],
  })
  .refine((data) => data.NODE_ENV !== 'production' || Boolean(data.SENTRY_DSN), {
    message: 'SENTRY_DSN es obligatorio en production (registro de errores centralizado)',
    path: ['SENTRY_DSN'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
