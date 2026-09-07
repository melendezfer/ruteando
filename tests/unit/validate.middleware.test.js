const { z } = require('zod');
const { validateBody, validateUuidParam } = require('../../src/middlewares/validate');
const { ValidationError, NotFoundError } = require('../../src/errors');

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('reemplaza req.body por los datos parseados y llama next() sin error', () => {
    const req = { body: { name: 'Ana', extra: 'ignorar' } };
    const next = jest.fn();

    validateBody(schema)(req, {}, next);

    expect(req.body).toEqual({ name: 'Ana' });
    expect(next).toHaveBeenCalledWith();
  });

  it('pasa un ValidationError con errors por campo cuando el body es inválido', () => {
    const req = { body: {} };
    const next = jest.fn();

    validateBody(schema)(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.errors).toEqual([{ field: 'name', message: expect.any(String) }]);
  });
});

describe('validateUuidParam', () => {
  it('deja pasar un UUID bien formado', () => {
    const req = { params: { businessId: '01a07d3e-41f0-70c8-bce2-227eaec1dc10' } };
    const next = jest.fn();

    validateUuidParam('businessId')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza con 404 un id mal formado (nunca llega a la base de datos)', () => {
    const req = { params: { businessId: 'no-es-un-uuid' } };
    const next = jest.fn();

    validateUuidParam('businessId')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
