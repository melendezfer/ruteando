const {
  adminListQuerySchema,
  rejectBusinessSchema,
  moderationDecisionSchema,
} = require('../../src/validators/admin.validators');

describe('adminListQuerySchema', () => {
  it('acepta sin parámetros (limit por defecto)', () => {
    const result = adminListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(20);
  });

  it('rechaza un limit fuera de rango', () => {
    expect(adminListQuerySchema.safeParse({ limit: '999' }).success).toBe(false);
  });
});

describe('rejectBusinessSchema', () => {
  it('acepta sin reason', () => {
    expect(rejectBusinessSchema.safeParse({}).success).toBe(true);
  });

  it('acepta con reason', () => {
    const result = rejectBusinessSchema.safeParse({ reason: 'Falta información de contacto' });
    expect(result.success).toBe(true);
    expect(result.data.reason).toBe('Falta información de contacto');
  });

  it('rechaza un reason vacío', () => {
    expect(rejectBusinessSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('rechaza un reason más largo de 500 caracteres', () => {
    expect(rejectBusinessSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('moderationDecisionSchema', () => {
  it('acepta approved y rejected', () => {
    expect(moderationDecisionSchema.safeParse({ decision: 'approved' }).success).toBe(true);
    expect(moderationDecisionSchema.safeParse({ decision: 'rejected' }).success).toBe(true);
  });

  it('rechaza sin decision', () => {
    expect(moderationDecisionSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza un valor fuera del enum', () => {
    expect(moderationDecisionSchema.safeParse({ decision: 'pending' }).success).toBe(false);
  });
});
