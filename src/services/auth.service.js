const argon2 = require('argon2');
const usuariosRepo = require('../repositories/usuarios.repository');
const tokensRefrescoRepo = require('../repositories/tokensRefresco.repository');
const consentimientosService = require('./consentimientos.service');
const { REFRESH_TOKEN_TTL_MS } = require('../config/constants');
const { signAccessToken, generateOpaqueToken, hashToken } = require('./token.service');
const { ROLE_API_TO_DB, toApiUser } = require('./user.mapper');
const { ConflictError, UnauthorizedError, ConsentRequiredError } = require('../errors');

// RF-018: chequeo compartido por login() y refresh(), en ambos casos
// ANTES de emitir/rotar tokens — register() no lo usa, no cambia (ver
// CLAUDE.md sección "Épica 8").
async function exigirConsentimientoCompleto(usuarioId) {
  const faltantes = await consentimientosService.obtenerTiposObligatoriosFaltantes(usuarioId);
  if (faltantes.length > 0) {
    throw new ConsentRequiredError(faltantes);
  }
}

// Hash de referencia usado solo para que login() tarde lo mismo exista o
// no la cuenta (contra ataques de temporización que revelarían qué
// correos están registrados, además de la respuesta 401 ya genérica).
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$x+BxNUyJUsRvsOAw0Rf3RQ$v69hmeQm7y28m9wPpcnPjyf0670mM3aXXUuOymwnAtY';

async function emitirTokens(usuario) {
  const accessToken = signAccessToken(usuario);
  const refreshToken = generateOpaqueToken();
  const expiraEn = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await tokensRefrescoRepo.crear({
    usuarioId: usuario.id,
    tokenHash: hashToken(refreshToken),
    expiraEn,
  });

  return { accessToken, refreshToken, tokenType: 'Bearer', user: toApiUser(usuario) };
}

async function register({ fullName, email, password, role }) {
  const existente = await usuariosRepo.buscarPorCorreo(email);
  if (existente) {
    throw new ConflictError('El correo ya está registrado');
  }

  const contrasenaHash = await argon2.hash(password);
  const usuario = await usuariosRepo.crear({
    nombreCompleto: fullName,
    correo: email,
    contrasenaHash,
    rol: ROLE_API_TO_DB[role],
  });

  return emitirTokens(usuario);
}

async function login({ email, password }) {
  const usuario = await usuariosRepo.buscarPorCorreo(email);

  const passwordOk = await argon2.verify(usuario ? usuario.contrasena_hash : DUMMY_HASH, password);

  if (!usuario || !passwordOk || !usuario.activo) {
    // Un solo mensaje para credenciales inválidas, correo inexistente o
    // cuenta suspendida — distinguirlos permitiría enumerar cuentas.
    throw new UnauthorizedError('Credenciales inválidas');
  }

  await exigirConsentimientoCompleto(usuario.id);

  return emitirTokens(usuario);
}

async function refresh({ refreshToken }) {
  const tokenHash = hashToken(refreshToken);
  const registro = await tokensRefrescoRepo.buscarPorHash(tokenHash);

  if (!registro) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  if (registro.revocado_en) {
    // Un token ya rotado (o ya cerrado por logout) que vuelve a usarse es
    // la señal de reuso de RFC 9700 — probable robo. Se revoca toda la
    // familia de sesiones del usuario, no solo este token.
    await tokensRefrescoRepo.revocarTodosDeUsuario(registro.usuario_id);
    throw new UnauthorizedError('Refresh token inválido');
  }

  if (new Date(registro.expira_en).getTime() < Date.now()) {
    throw new UnauthorizedError('Refresh token expirado');
  }

  const usuario = await usuariosRepo.buscarPorId(registro.usuario_id);
  if (!usuario || !usuario.activo) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  // Antes de CUALQUIER mutación (emitirTokens crea una fila nueva,
  // marcarRevocado más abajo cierra la vieja) — así, si falta
  // consentimiento, el refresh token original queda intacto por
  // construcción, no por un rollback aparte: nunca se llega a rotar.
  await exigirConsentimientoCompleto(usuario.id);

  const tokens = await emitirTokens(usuario);

  // Buscar el registro recién creado por su hash para encadenar
  // reemplazado_por sin depender de un segundo valor de retorno.
  const nuevoRegistro = await tokensRefrescoRepo.buscarPorHash(hashToken(tokens.refreshToken));
  await tokensRefrescoRepo.marcarRevocado(registro.id, nuevoRegistro.id);

  return tokens;
}

async function logout({ refreshToken, usuarioId }) {
  const tokenHash = hashToken(refreshToken);
  const registro = await tokensRefrescoRepo.buscarPorHash(tokenHash);

  // Logout es idempotente por diseño: si el token no existe, ya está
  // revocado, o pertenece a otro usuario (autorización a nivel de objeto,
  // regla de seguridad #2), no se revela nada — simplemente no hay nada
  // que revocar.
  if (registro && !registro.revocado_en && registro.usuario_id === usuarioId) {
    await tokensRefrescoRepo.marcarRevocado(registro.id);
  }
}

// emitirTokens también se exporta para registroAsistido.service.js#reclamar
// — reclamar() emite el primer par de tokens exactamente como register(),
// sin el chequeo de consentimiento (exigirConsentimientoCompleto), porque
// como register(), es el primer momento en que la cuenta existe de verdad
// para su titular.
module.exports = { register, login, refresh, logout, emitirTokens };
