const crypto = require('node:crypto');
const argon2 = require('argon2');
const usuariosRepo = require('../repositories/usuarios.repository');
const codigosRecuperacionRepo = require('../repositories/codigosRecuperacion.repository');
const registroAsistidoRepo = require('../repositories/registroAsistido.repository');
const negociosService = require('./negocios.service');
const authService = require('./auth.service');
const { generateOpaqueToken, hashToken } = require('./token.service');
const { toApiUser } = require('./user.mapper');
const { toApiBusiness } = require('./business.mapper');
const { ConflictError, NotFoundError, UnauthorizedError } = require('../errors');
const { ASSISTED_CLAIM_TOKEN_TTL_MS } = require('../config/constants');

function generarTokenReclamo() {
  const claimToken = generateOpaqueToken();
  return {
    claimToken,
    codigoHash: hashToken(claimToken),
    expiraEn: new Date(Date.now() + ASSISTED_CLAIM_TOKEN_TTL_MS),
  };
}

/**
 * POST /auth/assisted-registration (solo administradores, ver
 * admin.routes.js-style requireRole en auth.routes.js). Crea el vendedor,
 * su negocio (nace 'pendiente', pasa por la misma cola de aprobación que
 * cualquier otro — RF-019, sin atajos por ser asistido) y el consentimiento
 * registro_asistido, todo en una transacción. La contraseña real la fija
 * el propio vendedor después, vía reclamar() — acá se guarda un hash
 * aleatorio no derivable (nadie puede loguearse con ninguna contraseña
 * hasta que exista una real).
 */
async function crear({ vendor, business, consentTextVersion }) {
  await negociosService.validarCategoria(business.categoryId);

  if (vendor.email) {
    const existente = await usuariosRepo.buscarPorCorreo(vendor.email);
    if (existente) {
      throw new ConflictError('El correo ya está registrado');
    }
  }

  const contrasenaHash = await argon2.hash(crypto.randomBytes(32).toString('hex'));
  const { claimToken, codigoHash, expiraEn } = generarTokenReclamo();

  const { usuario, negocio } = await registroAsistidoRepo.crearVendedorNegocioYConsentimiento({
    nombreCompleto: vendor.fullName,
    correo: vendor.email,
    telefono: vendor.phone,
    contrasenaHash,
    categoriaId: business.categoryId,
    nombreNegocio: business.name,
    descripcionNegocio: business.description,
    telefonoContacto: business.contactPhone,
    textoVersion: consentTextVersion,
    codigoHash,
    expiraEn,
  });

  return {
    user: toApiUser(usuario),
    business: toApiBusiness(negocio),
    claimToken,
    claimTokenExpiresAt: expiraEn,
  };
}

/**
 * PATCH /admin/users/{userId}/reissue-claim-token. 409 si la cuenta ya
 * fue reclamada (usuarios.contrasena_establecida_en no nulo) — sin esto,
 * un administrador podría generar en cualquier momento un token de "fijar
 * contraseña" para un vendedor que ya lleva meses usando su propia
 * contraseña. Mismo patrón fetch -> validar estado -> mutar que el resto
 * de las transiciones de la Épica 9.
 */
async function reemitirTokenReclamo(usuarioId) {
  const usuario = await usuariosRepo.buscarPorId(usuarioId);
  if (!usuario) {
    throw new NotFoundError('Usuario no encontrado');
  }
  if (usuario.contrasena_establecida_en) {
    throw new ConflictError(
      'El usuario ya reclamó su cuenta, no se puede reemitir un token de reclamo',
    );
  }

  await codigosRecuperacionRepo.invalidarActivosDeUsuario(usuarioId);
  const { claimToken, codigoHash, expiraEn } = generarTokenReclamo();
  await codigosRecuperacionRepo.crear({ usuarioId, codigoHash, expiraEn });

  return { claimToken, claimTokenExpiresAt: expiraEn };
}

/**
 * POST /auth/claim-assisted-account (pública — el token es la credencial,
 * igual que /auth/reset-password). Fija la contraseña real (lo que marca
 * la cuenta como reclamada, ver usuarios.repository.js#actualizarContrasena)
 * y emite el primer par de tokens sin chequeo de consentimiento — igual
 * que register(), es el primer momento en que la cuenta existe de verdad
 * para su titular. Los dos consentimientos obligatorios (RF-018) los
 * otorga el propio vendedor después, vía POST /consents ya existente; el
 * candado de login()/refresh() de la Épica 8 se aplica sin cambios.
 */
async function reclamar({ token, newPassword }) {
  const registro = await codigosRecuperacionRepo.buscarPorHash(hashToken(token));

  const esValido =
    registro && !registro.invalidado_en && new Date(registro.expira_en).getTime() >= Date.now();
  if (!esValido) {
    throw new UnauthorizedError('Token de reclamo inválido, expirado o ya usado');
  }

  const contrasenaHash = await argon2.hash(newPassword);
  await usuariosRepo.actualizarContrasena(registro.usuario_id, contrasenaHash);
  await codigosRecuperacionRepo.marcarInvalidado(registro.id);

  const usuario = await usuariosRepo.buscarPorId(registro.usuario_id);
  return authService.emitirTokens(usuario);
}

module.exports = { crear, reemitirTokenReclamo, reclamar };
