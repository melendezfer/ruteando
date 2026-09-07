const argon2 = require('argon2');
const usuariosRepo = require('../repositories/usuarios.repository');
const codigosRecuperacionRepo = require('../repositories/codigosRecuperacion.repository');
const tokensRefrescoRepo = require('../repositories/tokensRefresco.repository');
const { generateOpaqueToken, hashToken } = require('./token.service');
const { PASSWORD_RESET_CODE_TTL_MS } = require('../config/constants');
const { UnauthorizedError } = require('../errors');
const logger = require('../config/logger');

/**
 * RF-003. Solicita un código/enlace de recuperación de un solo uso.
 *
 * TODO(RF-003): todavía no hay proveedor de correo elegido (no está en la
 * tabla de variables del Documento 14, sección 1.4 — ver CLAUDE.md
 * sección 10). Mientras tanto, en vez de enviar un correo real, el enlace
 * se registra en el log estructurado. Cuando se elija un proveedor
 * (ej. Resend, SES), reemplazar este bloque por el envío real y quitar el
 * log del enlace completo (no debe quedar en logs de producción).
 */
async function solicitarRecuperacion({ email }) {
  const usuario = await usuariosRepo.buscarPorCorreo(email);

  // Misma respuesta exista o no la cuenta (RF-003 + no enumeración): el
  // llamador nunca sabe si el correo estaba registrado.
  if (!usuario) {
    return;
  }

  await codigosRecuperacionRepo.invalidarActivosDeUsuario(usuario.id);

  const codigo = generateOpaqueToken();
  const expiraEn = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);

  await codigosRecuperacionRepo.crear({
    usuarioId: usuario.id,
    codigoHash: hashToken(codigo),
    expiraEn,
  });

  logger.info(
    { usuarioId: usuario.id, resetToken: codigo, expiraEn },
    'TODO(RF-003): envío de correo real pendiente de proveedor — enlace de recuperación generado',
  );
}

async function restablecerContrasena({ token, newPassword }) {
  const registro = await codigosRecuperacionRepo.buscarPorHash(hashToken(token));

  const esValido =
    registro && !registro.invalidado_en && new Date(registro.expira_en).getTime() >= Date.now();

  if (!esValido) {
    throw new UnauthorizedError('Token de recuperación inválido, expirado o ya usado');
  }

  const contrasenaHash = await argon2.hash(newPassword);

  await usuariosRepo.actualizarContrasena(registro.usuario_id, contrasenaHash);
  await codigosRecuperacionRepo.marcarInvalidado(registro.id);
  // Cambiar la contraseña revoca todas las sesiones existentes: si alguien
  // más tenía un refresh token válido, deja de servir.
  await tokensRefrescoRepo.revocarTodosDeUsuario(registro.usuario_id);
}

module.exports = { solicitarRecuperacion, restablecerContrasena };
