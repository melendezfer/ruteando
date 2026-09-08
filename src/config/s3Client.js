const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

// forcePathStyle: true es lo que hace que esto funcione igual contra MinIO
// (desarrollo/CI) y contra R2/B2 (staging/production) — ninguno de los
// dos resuelve el bucket por subdominio como el S3 real de AWS. region es
// un valor requerido por el SDK pero irrelevante para estos proveedores.
const s3Client = new S3Client({
  region: 'auto',
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

module.exports = s3Client;
