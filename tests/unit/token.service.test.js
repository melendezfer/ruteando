const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
} = require('../../src/services/token.service');

describe('token.service', () => {
  describe('signAccessToken', () => {
    it('firma un JWT con sub, role y expiración de 15 minutos', () => {
      const token = signAccessToken({ id: 'user-1', rol: 'vendedor' });
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe('vendor'); // mapeado a inglés, no 'vendedor'
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('rechaza la verificación con un secreto distinto', () => {
      const token = signAccessToken({ id: 'user-1', rol: 'consumidor' });
      expect(() => jwt.verify(token, 'otro-secreto-cualquiera')).toThrow();
    });
  });

  describe('generateOpaqueToken', () => {
    it('genera cadenas suficientemente largas y distintas en cada llamada', () => {
      const a = generateOpaqueToken();
      const b = generateOpaqueToken();

      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(48);
    });
  });

  describe('hashToken', () => {
    it('es determinístico (mismo input -> mismo hash)', () => {
      expect(hashToken('mismo-valor')).toBe(hashToken('mismo-valor'));
    });

    it('produce un hash distinto para inputs distintos', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('nunca devuelve el valor original', () => {
      expect(hashToken('mi-token-secreto')).not.toContain('mi-token-secreto');
    });
  });
});
