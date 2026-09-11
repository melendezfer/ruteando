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
//
// Extendido (2026-09-11) para cerrar un candado real que dejaba cuentas
// creadas antes de que el frontend pidiera este consentimiento (o
// cualquiera que nunca lo haya otorgado) bloqueadas para siempre: sin
// tokens no hay forma de llamar POST /consents (exige autenticación), y
// login()/refresh() nunca los emiten sin consentimiento — un callejón
// sin salida real, no solo una pantalla incómoda. login() ahora acepta
// un `consentsProvistos` opcional en el mismo request: la contraseña ya
// se verificó arriba (prueba de identidad suficiente), así que si cubre
// exactamente lo que falta, se otorga ahí mismo y se continúa sin un
// segundo viaje de ida y vuelta. Si no alcanza (o no viene, como en
// refresh(), que sigue llamando esta función sin ese argumento), se
// rechaza igual que antes, con missingConsentTypes para que el cliente
// sepa qué pedir.
async function exigirOConcederConsentimiento(usuarioId, consentsProvistos) {
  const faltantes = await consentimientosService.obtenerTiposObligatoriosFaltantes(usuarioId);
  if (faltantes.length === 0) return;

  const provistosPorTipo = new Map((consentsProvistos ?? []).map((c) => [c.type, c]));
  const todosCubiertos = faltantes.every((tipo) => provistosPorTipo.has(tipo));
  if (!todosCubiertos) {
    throw new ConsentRequiredError(faltantes);
  }

  // Solo los que de verdad faltaban — nunca duplica uno ya otorgado, ni
  // aunque el cliente lo haya vuelto a mandar.
  for (const tipo of faltantes) {
    const { textVersion } = provistosPorTipo.get(tipo);
    await consentimientosService.crear({ actorUserId: usuarioId, body: { type: tipo, textVersion } });
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

// ip: respaldo interno (usuarios.ip_origen, ver
// usuarios.repository.js#crear) — nunca influye en si el registro tiene
// éxito ni se devuelve en la respuesta, solo se guarda.
async function register({ fullName, email, password, role, ip }) {
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
    ipOrigen: ip,
  });

  return emitirTokens(usuario);
}

async function login({ email, password, consents }) {
  const usuario = await usuariosRepo.buscarPorCorreo(email);

  const passwordOk = await argon2.verify(usuario ? usuario.contrasena_hash : DUMMY_HASH, password);

  if (!usuario || !passwordOk || !usuario.activo) {
    // Un solo mensaje para credenciales inválidas, correo inexistente o
    // cuenta suspendida — distinguirlos permitiría enumerar cuentas.
    throw new UnauthorizedError('Credenciales inválidas');
  }

  await exigirOConcederConsentimiento(usuario.id, consents);

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
  // Sin `consents` (a diferencia de login()) — refresh() es una llamada
  // silenciosa en segundo plano (auth-context.tsx la dispara al montar
  // la app), sin ninguna pantalla propia donde pedirle algo al usuario;
  // el camino de recuperación real para una cuenta bloqueada sigue
  // siendo login(), que si falla aquí, deja sesión "unauthenticated" y
  // al usuario en la pantalla de login normal.
  await exigirOConcederConsentimiento(usuario.id);

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
