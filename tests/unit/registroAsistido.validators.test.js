const {
  assistedRegistrationInputSchema,
  claimAssistedAccountSchema,
} = require('../../src/validators/registroAsistido.validators');

describe('assistedRegistrationInputSchema', () => {
  const base = {
    vendor: { fullName: 'Vendedor de Prueba' },
    business: { name: 'Negocio de Prueba', categoryId: 1 },
    consentTextVersion: 'v1',
  };

  it('acepta sin email ni phone (ambos opcionales)', () => {
    expect(assistedRegistrationInputSchema.safeParse(base).success).toBe(true);
  });

  it('acepta con email y phone', () => {
    const result = assistedRegistrationInputSchema.safeParse({
      ...base,
      vendor: { ...base.vendor, email: 'vendedor@example.com', phone: '3001234567' },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza sin vendor.fullName', () => {
    expect(assistedRegistrationInputSchema.safeParse({ ...base, vendor: {} }).success).toBe(false);
  });

  it('rechaza un email con formato inválido', () => {
    expect(
      assistedRegistrationInputSchema.safeParse({
        ...base,
        vendor: { ...base.vendor, email: 'no-es-un-correo' },
      }).success,
    ).toBe(false);
  });

  it('rechaza sin business.categoryId', () => {
    expect(
      assistedRegistrationInputSchema.safeParse({
        ...base,
        business: { name: 'Negocio de Prueba' },
      }).success,
    ).toBe(false);
  });

  it('rechaza sin consentTextVersion', () => {
    const sinVersion = { vendor: base.vendor, business: base.business };
    expect(assistedRegistrationInputSchema.safeParse(sinVersion).success).toBe(false);
  });
});

describe('claimAssistedAccountSchema', () => {
  it('acepta token + newPassword válidos', () => {
    expect(
      claimAssistedAccountSchema.safeParse({ token: 'abc', newPassword: 'password123' }).success,
    ).toBe(true);
  });

  it('rechaza una newPassword de menos de 8 caracteres', () => {
    expect(
      claimAssistedAccountSchema.safeParse({ token: 'abc', newPassword: 'short' }).success,
    ).toBe(false);
  });

  it('rechaza sin token', () => {
    expect(claimAssistedAccountSchema.safeParse({ newPassword: 'password123' }).success).toBe(
      false,
    );
  });
});
