const argon2 = require('argon2');
const administradoresRepo = require('../repositories/administradores.repository');
const tokensRefrescoAdminRepo = require('../repositories/tokensRefrescoAdministrador.repository');
const { ADMIN_REFRESH_TOKEN_TTL_MS } = require('../config/constants');
const { signAdminAccessToken } = require('./adminToken.service');
const { generateOpaqueToken, hashToken } = require('./token.service');
const { toApiAdministrator } = require('./administrador.mapper');
const { UnauthorizedError } = require('../errors');

/**
 * Login de administrador (Fase 1 del panel — sin RF asociado, ver
 * CLAUDE.md): mismo patrón de autenticación que auth.service.js
 * (JWT de corta duración + refresh token rotativo, contraseña con
 * argon2), pero SEPARADO — ni comparte tabla, ni comparte secreto de
 * firma, ni pasa por el chequeo de consentimiento de RF-018 (Ley 1581
 * no le aplica a una cuenta de administrador de la plataforma, a
 * diferencia de un usuario final).
 */

// Mismo motivo que auth.service.js#DUMMY_HASH: que login() tarde lo
// mismo exista o no la cuenta, contra ataques de temporización.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$x+BxNUyJUsRvsOAw0Rf3RQ$v69hmeQm7y28m9wPpcnPjyf0670mM3aXXUuOymwnAtY';

async function emitirTokens(administrador) {
  const accessToken = signAdminAccessToken(administrador);
  const refreshToken = generateOpaqueToken();
  const expiraEn = new Date(Date.now() + ADMIN_REFRESH_TOKEN_TTL_MS);

  await tokensRefrescoAdminRepo.crear({
    administradorId: administrador.id,
    tokenHash: hashToken(refreshToken),
    expiraEn,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    admin: toApiAdministrator(administrador),
  };
}

async function login({ email, password }) {
  const administrador = await administradoresRepo.buscarPorCorreo(email);

  const passwordOk = await argon2.verify(
    administrador ? administrador.contrasena_hash : DUMMY_HASH,
    password,
  );

  if (!administrador || !passwordOk || !administrador.activo) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  return emitirTokens(administrador);
}

async function refresh({ refreshToken }) {
  const tokenHash = hashToken(refreshToken);
  const registro = await tokensRefrescoAdminRepo.buscarPorHash(tokenHash);

  if (!registro) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  if (registro.revocado_en) {
    // Reuso de un token ya rotado (RFC 9700) — señal probable de robo:
    // se revoca toda la familia de sesiones de este administrador, no
    // solo este token. Mismo criterio que auth.service.js#refresh.
    await tokensRefrescoAdminRepo.revocarTodosDeAdministrador(registro.administrador_id);
    throw new UnauthorizedError('Refresh token inválido');
  }

  if (new Date(registro.expira_en).getTime() < Date.now()) {
    throw new UnauthorizedError('Refresh token expirado');
  }

  const administrador = await administradoresRepo.buscarPorId(registro.administrador_id);
  if (!administrador || !administrador.activo) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  const tokens = await emitirTokens(administrador);

  const nuevoRegistro = await tokensRefrescoAdminRepo.buscarPorHash(hashToken(tokens.refreshToken));
  await tokensRefrescoAdminRepo.marcarRevocado(registro.id, nuevoRegistro.id);

  return tokens;
}

async function logout({ refreshToken, administradorId }) {
  const tokenHash = hashToken(refreshToken);
  const registro = await tokensRefrescoAdminRepo.buscarPorHash(tokenHash);

  // Idempotente, misma autorización a nivel de objeto que auth.service.js#logout.
  if (registro && !registro.revocado_en && registro.administrador_id === administradorId) {
    await tokensRefrescoAdminRepo.marcarRevocado(registro.id);
  }
}

module.exports = { login, refresh, logout, emitirTokens };
