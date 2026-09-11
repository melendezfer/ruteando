const crypto = require('node:crypto');
const negociosRepo = require('../repositories/negocios.repository');
const codigosRepo = require('../repositories/codigosVerificacionTelefono.repository');
const smsSender = require('./smsSender.service');
const { hashToken } = require('./token.service');
const { toApiBusiness } = require('./business.mapper');
const {
  PHONE_VERIFICATION_CODE_TTL_MS,
  PHONE_VERIFICATION_MAX_ATTEMPTS,
  PHONE_VERIFICATION_RATE_LIMIT_MAX,
  PHONE_VERIFICATION_RATE_LIMIT_WINDOW_MINUTES,
} = require('../config/constants');
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
  TooManyRequestsError,
} = require('../errors');

/**
 * Verificación de teléfono de vendedores (ver CLAUDE.md): un negocio no
 * aparece en el mapa/búsqueda pública hasta que su dueño confirme, por
 * SMS, el mismo número que ya iba a publicar como contacto de WhatsApp
 * (negocios.repository.js#listar/cercanos ya filtran por
 * telefono_verificado — este archivo es lo único que puede ponerlo en
 * true).
 */

async function obtenerCrudoOFallar(id) {
  const negocio = await negociosRepo.buscarPorId(id);
  if (!negocio) {
    throw new NotFoundError('Negocio no encontrado');
  }
  return negocio;
}

function verificarPropietario(negocio, usuarioId) {
  if (negocio.usuario_id !== usuarioId) {
    throw new ForbiddenError('No es el propietario de este negocio');
  }
}

function generarCodigo() {
  // 6 dígitos, con ceros a la izquierda si hace falta (ej. "004821") —
  // crypto.randomInt (no Math.random) porque es criptográficamente
  // seguro, igual que generateOpaqueToken en token.service.js.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** POST /businesses/{businessId}/phone-verification. */
async function enviarCodigo(usuarioId, negocioId) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  if (!negocio.telefono_contacto) {
    throw new ValidationError('El negocio no tiene un teléfono de contacto registrado', {
      errors: [
        { field: 'contactPhone', message: 'Registra un teléfono de contacto antes de verificarlo' },
      ],
    });
  }

  // Idempotente: reenviar un código a un negocio que ya quedó verificado
  // (ej. dos pestañas abiertas) no es un error, simplemente no hace nada
  // — mismo criterio que favoritos.service.js#marcar.
  if (negocio.telefono_verificado) {
    return;
  }

  const recientes = await codigosRepo.contarRecientesDelNegocio({
    negocioId,
    windowMinutes: PHONE_VERIFICATION_RATE_LIMIT_WINDOW_MINUTES,
  });
  if (recientes >= PHONE_VERIFICATION_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError(
      `Demasiados códigos solicitados (máximo ${PHONE_VERIFICATION_RATE_LIMIT_MAX} por ${PHONE_VERIFICATION_RATE_LIMIT_WINDOW_MINUTES} min)`,
    );
  }

  // Un código nuevo invalida cualquiera anterior todavía activo — solo
  // el último enviado debe poder confirmarse.
  await codigosRepo.invalidarActivosDelNegocio(negocioId);

  const codigo = generarCodigo();
  const expiraEn = new Date(Date.now() + PHONE_VERIFICATION_CODE_TTL_MS);

  await codigosRepo.crear({
    negocioId,
    telefono: negocio.telefono_contacto,
    codigoHash: hashToken(codigo),
    expiraEn,
  });

  await smsSender.enviarCodigo({ telefono: negocio.telefono_contacto, codigo });
}

/** POST /businesses/{businessId}/phone-verification/confirm. */
async function confirmarCodigo(usuarioId, negocioId, codigo) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  // Idempotente en el otro sentido: confirmar de nuevo un negocio ya
  // verificado simplemente devuelve el estado actual, sin exigir un
  // código vigente que puede que ya no exista.
  if (negocio.telefono_verificado) {
    return toApiBusiness(negocio);
  }

  const registro = await codigosRepo.buscarActivoDelNegocio(negocioId);
  const vigente =
    registro && !registro.invalidado_en && new Date(registro.expira_en).getTime() >= Date.now();

  if (!vigente) {
    throw new UnauthorizedError('No hay un código de verificación vigente — solicita uno nuevo');
  }

  if (registro.intentos >= PHONE_VERIFICATION_MAX_ATTEMPTS) {
    await codigosRepo.invalidar(registro.id);
    throw new TooManyRequestsError('Demasiados intentos fallidos — solicita un código nuevo');
  }

  if (hashToken(codigo) !== registro.codigo_hash) {
    await codigosRepo.incrementarIntentos(registro.id);
    throw new UnauthorizedError('Código incorrecto');
  }

  await codigosRepo.invalidar(registro.id);
  const actualizado = await negociosRepo.marcarTelefonoVerificado(negocioId);
  return toApiBusiness(actualizado);
}

module.exports = { enviarCodigo, confirmarCodigo };
