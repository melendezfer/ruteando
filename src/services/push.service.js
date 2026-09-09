const firebaseApp = require('../config/firebaseClient');
const tokensDispositivoRepo = require('../repositories/tokensDispositivo.repository');
const logger = require('../config/logger');

/**
 * Best-effort, nunca hace fallar al llamador — mismo criterio que la
 * limpieza de storage (almacenamiento.service.js#borrarPorUrlSilencioso):
 * si Firebase no está configurado o el usuario no tiene ningún
 * dispositivo registrado, se loguea y no se envía nada; si el SDK falla
 * para un token puntual (inválido, desinstalado, etc.), se loguea ese
 * fallo pero no se tumban los demás envíos ni la solicitud que disparó
 * este push.
 *
 * Limitación real, no oculta: esta función solo puede probarse
 * verificando que llama al SDK de Firebase Admin con el payload correcto
 * (mockeado en las pruebas) — no hay forma de confirmar que un push
 * realmente sonó en un celular sin un cliente real que registre un token
 * FCM de verdad, y ese cliente todavía no existe.
 */
async function enviarAUsuario(usuarioId, { title, body, data }) {
  if (!firebaseApp) {
    logger.warn(
      { usuarioId },
      'Firebase no configurado (ver FIREBASE_* en .env) — push no enviado',
    );
    return;
  }

  const tokens = await tokensDispositivoRepo.listarPorUsuario(usuarioId);
  if (tokens.length === 0) {
    logger.warn({ usuarioId }, 'Usuario sin tokens de dispositivo registrados — push no enviado');
    return;
  }

  const mensajeria = firebaseApp.messaging();
  const resultados = await Promise.allSettled(
    tokens.map((t) => mensajeria.send({ token: t.token, notification: { title, body }, data })),
  );

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'rejected') {
      logger.warn(
        { usuarioId, tokenId: tokens[i].id, err: resultado.reason },
        'Fallo al enviar push a un dispositivo',
      );
    }
  });
}

module.exports = { enviarAUsuario };
