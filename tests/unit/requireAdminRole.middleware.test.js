const requireAdminRole = require('../../src/middlewares/requireAdminRole');
const { ForbiddenError } = require('../../src/errors');

describe('requireAdminRole middleware', () => {
  it('deja pasar cuando el rol del administrador está permitido', () => {
    const req = { admin: { role: 'admin' } };
    const next = jest.fn();

    requireAdminRole('admin', 'super_admin')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('deja pasar a super_admin cuando el módulo exige justo ese rol', () => {
    const req = { admin: { role: 'super_admin' } };
    const next = jest.fn();

    requireAdminRole('super_admin')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza con 403 a un admin delegado cuando el módulo exige super_admin', () => {
    const req = { admin: { role: 'admin' } };
    const next = jest.fn();

    requireAdminRole('super_admin')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
