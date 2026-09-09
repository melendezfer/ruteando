const { deviceTokenInputSchema } = require('../../src/validators/deviceTokens.validators');

describe('deviceTokenInputSchema', () => {
  it('acepta un token válido', () => {
    expect(deviceTokenInputSchema.safeParse({ token: 'fcm-token-abc123' }).success).toBe(true);
  });

  it('rechaza sin token', () => {
    expect(deviceTokenInputSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza un token vacío', () => {
    expect(deviceTokenInputSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('rechaza un token más largo de 4096 caracteres', () => {
    expect(deviceTokenInputSchema.safeParse({ token: 'x'.repeat(4097) }).success).toBe(false);
  });
});
