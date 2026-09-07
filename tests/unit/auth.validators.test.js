const {
  registerSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} = require('../../src/validators/auth.validators');

describe('registerSchema', () => {
  it('acepta un registro válido de consumidor o vendedor', () => {
    expect(
      registerSchema.safeParse({
        fullName: 'Ana Prueba',
        email: 'ana@example.com',
        password: 'password123',
        role: 'consumer',
      }).success,
    ).toBe(true);
  });

  it('rechaza una contraseña de menos de 8 caracteres', () => {
    const result = registerSchema.safeParse({
      fullName: 'Ana',
      email: 'ana@example.com',
      password: '1234567',
      role: 'consumer',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza role = administrator (no se puede autoregistrar como admin)', () => {
    const result = registerSchema.safeParse({
      fullName: 'Ana',
      email: 'ana@example.com',
      password: 'password123',
      role: 'administrator',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un correo con formato inválido', () => {
    const result = registerSchema.safeParse({
      fullName: 'Ana',
      email: 'no-es-un-correo',
      password: 'password123',
      role: 'consumer',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requiere email y password', () => {
    expect(loginSchema.safeParse({ email: 'ana@example.com' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('rechaza un refreshToken vacío', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('exige newPassword de al menos 8 caracteres', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', newPassword: '123' }).success).toBe(false);
  });
});
