const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const authenticate = require('../../src/middlewares/authenticate');
const { UnauthorizedError } = require('../../src/errors');

function buildReq(authorizationHeader) {
  return { headers: { authorization: authorizationHeader } };
}

describe('authenticate middleware', () => {
  it('deja pasar y adjunta req.user con un token válido', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'consumer' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const req = buildReq(`Bearer ${token}`);
    const next = jest.fn();

    authenticate(req, {}, next);

    expect(req.user).toEqual({ id: 'user-1', role: 'consumer' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza cuando falta el header Authorization', () => {
    const next = jest.fn();
    authenticate(buildReq(undefined), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un esquema distinto de Bearer', () => {
    const next = jest.fn();
    authenticate(buildReq('Basic algo'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un token con firma inválida', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'consumer' }, 'secreto-equivocado', {
      expiresIn: '15m',
    });
    const next = jest.fn();

    authenticate(buildReq(`Bearer ${token}`), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza un token expirado', () => {
    // exp en el pasado, construido a mano en vez de esperar 15 minutos.
    const token = jwt.sign(
      { sub: 'user-1', role: 'consumer', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
    );
    const next = jest.fn();

    authenticate(buildReq(`Bearer ${token}`), {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
