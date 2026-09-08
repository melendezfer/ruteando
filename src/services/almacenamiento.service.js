const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3Client');
const env = require('../config/env');

// STORAGE_ENDPOINT es el endpoint de la API S3 (contra el que el SDK firma
// PUT/DELETE, ver s3Client.js) — en R2/B2 real ese host no sirve lectura
// pública anónima. STORAGE_PUBLIC_URL es la base de lectura real; si no
// está configurada (dev/CI con MinIO, donde el mismo endpoint sí es
// alcanzable por el cliente) se usa STORAGE_ENDPOINT como respaldo — pero
// env.js exige STORAGE_PUBLIC_URL explícita en production, así que ese
// respaldo nunca aplica ahí.
const BASE_PUBLICA = env.STORAGE_PUBLIC_URL || env.STORAGE_ENDPOINT;

/**
 * Sube un objeto ya procesado (ver imagen.service.js) al bucket
 * S3-compatible configurado (MinIO en dev/CI, R2/B2 en staging/production)
 * y devuelve la URL pública con la que se guarda en fotos.url.
 */
async function subir(key, buffer, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${BASE_PUBLICA}/${env.STORAGE_BUCKET}/${key}`;
}

async function borrar(key) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
}

/**
 * fotos.url guarda la URL completa que devolvió subir(), no la key sola —
 * para borrar hay que reconstruir la key a partir de esa misma URL en vez
 * de guardar una columna aparte solo para esto.
 */
function extraerKeyDeUrl(url) {
  const prefijo = `${BASE_PUBLICA}/${env.STORAGE_BUCKET}/`;
  return url.startsWith(prefijo) ? url.slice(prefijo.length) : null;
}

/**
 * Borrado best-effort: si el objeto remoto ya no existe o el storage está
 * caído, no debe tumbar la operación de negocio (borrar la foto en la
 * base de datos) que la llamó — solo se registra en el log. Un huérfano
 * ocasional en el bucket es aceptable; una foto que el usuario no puede
 * borrar en la app porque el storage tuvo un hipo, no.
 */
async function borrarPorUrlSilencioso(url, logger) {
  const key = extraerKeyDeUrl(url);
  if (!key) return;
  try {
    await borrar(key);
  } catch (err) {
    logger?.warn({ err, url }, 'No se pudo borrar el objeto en el almacenamiento remoto');
  }
}

module.exports = { subir, borrar, extraerKeyDeUrl, borrarPorUrlSilencioso };
