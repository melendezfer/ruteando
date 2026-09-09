const admin = require('firebase-admin');
const env = require('./env');

/**
 * null en development/staging sin credenciales configuradas —
 * push.service.js lo trata como "no hay proveedor de push conectado
 * todavía" (mismo tipo de gap que el envío de correo de RF-003, sin
 * proveedor elegido) en vez de fallar. Obligatorio en production (ver
 * env.js).
 */
const firebaseApp = env.FIREBASE_PROJECT_ID
  ? admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        // Firebase exporta la llave privada con saltos de línea reales; en
        // una sola línea de .env llegan escapados como "\n" literal — hay
        // que revertirlo antes de pasarla al SDK.
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  : null;

module.exports = firebaseApp;
