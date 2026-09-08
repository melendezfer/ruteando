const { consentInputSchema } = require('../../src/validators/consentimientos.validators');

describe('consentInputSchema', () => {
  it('acepta un consentimiento mínimo válido', () => {
    const result = consentInputSchema.safeParse({ type: 'data_processing', textVersion: 'v1' });
    expect(result.success).toBe(true);
    expect(result.data.grantedByThirdParty).toBe(false);
  });

  it('acepta los 4 valores del enum type', () => {
    for (const type of [
      'data_processing',
      'terms_conditions',
      'assisted_registration',
      'notifications',
    ]) {
      expect(consentInputSchema.safeParse({ type, textVersion: 'v1' }).success).toBe(true);
    }
  });

  it('rechaza un type fuera del enum', () => {
    expect(
      consentInputSchema.safeParse({ type: 'not_a_real_type', textVersion: 'v1' }).success,
    ).toBe(false);
  });

  it('rechaza sin type', () => {
    expect(consentInputSchema.safeParse({ textVersion: 'v1' }).success).toBe(false);
  });

  it('rechaza sin textVersion', () => {
    expect(consentInputSchema.safeParse({ type: 'data_processing' }).success).toBe(false);
  });

  it('rechaza textVersion más largo de 20 caracteres (VARCHAR(20) en schema.sql)', () => {
    const result = consentInputSchema.safeParse({
      type: 'data_processing',
      textVersion: 'x'.repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it('acepta businessId opcional', () => {
    const result = consentInputSchema.safeParse({
      type: 'assisted_registration',
      textVersion: 'v1',
      businessId: '01a07d3e-41f0-70c8-bce2-227eaec1dc10',
    });
    expect(result.success).toBe(true);
  });

  it('acepta grantedByThirdParty explícito', () => {
    const result = consentInputSchema.safeParse({
      type: 'assisted_registration',
      textVersion: 'v1',
      grantedByThirdParty: true,
    });
    expect(result.data.grantedByThirdParty).toBe(true);
  });
});
