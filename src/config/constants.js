// Duraciones de token fijas por especificación (Documento 14, sección 1.4:
// "Firma de tokens de acceso (15 min)" / "... refresh tokens rotativos (30
// días)"). No son variables de entorno — el documento las trata como
// parte del contrato de JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, no como
// valores configurables por ambiente.
module.exports = {
  JWT_ACCESS_TOKEN_TTL: '15m',
  JWT_REFRESH_TOKEN_TTL: '30d',
};
