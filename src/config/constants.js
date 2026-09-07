// Duraciones fijas por especificación (Documento 14, sección 1.4: "Firma de
// tokens de acceso (15 min)" / "... refresh tokens rotativos (30 días)").
// No son variables de entorno — el documento las trata como parte del
// contrato de JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, no como valores
// configurables por ambiente.
//
// El access token es un JWT (jsonwebtoken usa su propio formato de
// duración, ej. '15m'). El refresh token es una cadena opaca, no un JWT
// (ver src/services/token.service.js) — su expiración se calcula a mano,
// por eso se guarda también en milisegundos.
module.exports = {
  JWT_ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET_CODE_TTL_MS: 15 * 60 * 1000,

  // RF-025 es público (sin auth obligatoria) — límite de abuso por
  // negocio + origen (usuario_id si está logueado, si no ip_origen).
  // 3 en 10 minutos: deja pasar el uso legítimo (alguien nota algo raro y
  // reporta un par de veces) sin permitir un spam sostenido contra un
  // negocio puntual.
  OUTDATED_REPORT_RATE_LIMIT_MAX: 3,
  OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES: 10,
};
