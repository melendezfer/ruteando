const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const authenticateAdmin = require('../../src/middlewares/authenticateAdmin');
const { UnauthorizedError } = require('../../src/errors');

function buildReq(authorizationHeader) {
  return { headers: { authorization: authorizationHeader } };
}

describe('authenticateAdmin middleware', () => {
  it('deja pasar y adjunta req.admin con un token válido firmado con ADMIN_JWT_ACCESS_SECRET', () => {
    const token = jwt.sign({ sub: 'admin-1', role: 'admin' }, env.ADMIN_JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const req = buildReq(`Bearer ${token}`);
    const next = jest.fn();

    authenticateAdmin(req, {}, next);

    expect(req.admin).toEqual({ id: 'admin-1', role: 'admin' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza cuando falta el header Authorization', () => {
    const next = jest.fn();
    authenticateAdmin(buildReq(undefined), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un esquema distinto de Bearer', () => {
    const next = jest.fn();
    authenticateAdmin(buildReq('Basic algo'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  // Regla de seguridad clave de este sistema: un token firmado con el
  // secreto de USUARIOS normales (JWT_ACCESS_SECRET) debe ser
  // estructuralmente inverificable acá — secretos distintos a
  // propósito, ver env.js.
  it('rechaza un token válido de usuarios normales (firmado con JWT_ACCESS_SECRET, secreto distinto)', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'administrator' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const next = jest.fn();

    authenticateAdmin(buildReq(`Bearer ${token}`), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un token con firma inválida', () => {
    const token = jwt.sign({ sub: 'admin-1', role: 'admin' }, 'secreto-equivocado', {
      expiresIn: '15m',
    });
    const next = jest.fn();

    authenticateAdmin(buildReq(`Bearer ${token}`), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un token expirado', () => {
    const token = jwt.sign(
      { sub: 'admin-1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 },
      env.ADMIN_JWT_ACCESS_SECRET,
    );
    const next = jest.fn();

    authenticateAdmin(buildReq(`Bearer ${token}`), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
