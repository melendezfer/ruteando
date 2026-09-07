const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { JWT_ACCESS_TOKEN_TTL } = require('../config/constants');
const { ROLE_DB_TO_API } = require('./user.mapper');

/**
 * El access token es un JWT firmado, verificable sin ir a la base de
 * datos. El refresh token y el código de recuperación son cadenas
 * aleatorias opacas (no JWT): su validez/revocación solo puede
 * comprobarse contra la base de datos, que es exactamente lo que
 * necesitamos para poder revocarlos antes de que expiren.
 */

function signAccessToken(usuario) {
  return jwt.sign({ sub: usuario.id, role: ROLE_DB_TO_API[usuario.rol] }, env.JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_TOKEN_TTL,
  });
}

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { signAccessToken, generateOpaqueToken, hashToken };
