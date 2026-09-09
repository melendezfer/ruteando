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
    // STORAGE_ENDPOINT es el endpoint de la API S3 (contra el que el SDK
    // firma PUT/DELETE) — en R2/B2 real ese host NO sirve lectura pública
    // anónima de los objetos (devuelve 401/403), así que no sirve como URL
    // para fotos.url. STORAGE_PUBLIC_URL es la base de lectura pública
    // real (bucket público de R2, dominio custom, o el CDN delante de B2).
    // Opcional: si no está configurada, se usa STORAGE_ENDPOINT como antes
    // — correcto en dev/CI con MinIO, donde el mismo endpoint sí es
    // alcanzable por el cliente; en production es obligatorio configurarla
    // aparte (ver almacenamiento.service.js).
    STORAGE_PUBLIC_URL: z.string().min(1).optional(),

    SENTRY_DSN: z.string().optional(),

    // Confirmación de disponibilidad en tiempo real — credenciales de la
    // cuenta de servicio de Firebase (ver src/config/firebaseClient.js).
    // Opcionales en dev/staging (el envío de push se degrada a un no-op
    // logueado sin ellas, igual que el correo de RF-003 sin proveedor
    // elegido); obligatorias en production.
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

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
  })
  .refine((data) => data.NODE_ENV !== 'production' || Boolean(data.STORAGE_PUBLIC_URL), {
    message:
      'STORAGE_PUBLIC_URL es obligatorio en production — STORAGE_ENDPOINT (la API de R2/B2) no sirve lectura pública de las fotos',
    path: ['STORAGE_PUBLIC_URL'],
  })
  .refine(
    (data) =>
      data.NODE_ENV !== 'production' ||
      (Boolean(data.FIREBASE_PROJECT_ID) &&
        Boolean(data.FIREBASE_CLIENT_EMAIL) &&
        Boolean(data.FIREBASE_PRIVATE_KEY)),
    {
      message:
        'FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY son obligatorias en production (confirmación de disponibilidad en tiempo real)',
      path: ['FIREBASE_PROJECT_ID'],
    },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
