const requireRole = require('../../src/middlewares/requireRole');
const { ForbiddenError } = require('../../src/errors');

describe('requireRole middleware', () => {
  it('deja pasar cuando el rol del usuario está permitido', () => {
    const req = { user: { role: 'vendor' } };
    const next = jest.fn();

    requireRole('vendor', 'administrator')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza con 403 cuando el rol no está permitido', () => {
    const req = { user: { role: 'consumer' } };
    const next = jest.fn();

    requireRole('vendor')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
