const {
  reviewInputSchema,
  reviewListQuerySchema,
} = require('../../src/validators/resenas.validators');

describe('reviewInputSchema', () => {
  it('acepta un rating válido sin comentario', () => {
    expect(reviewInputSchema.safeParse({ rating: 5 }).success).toBe(true);
  });

  it('acepta rating + comment', () => {
    expect(reviewInputSchema.safeParse({ rating: 3, comment: 'Regular' }).success).toBe(true);
  });

  it('rechaza sin rating', () => {
    expect(reviewInputSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza rating fuera de 1-5', () => {
    expect(reviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it('rechaza rating no entero', () => {
    expect(reviewInputSchema.safeParse({ rating: 3.5 }).success).toBe(false);
  });

  it('rechaza un comment más largo de 1000 caracteres', () => {
    expect(reviewInputSchema.safeParse({ rating: 4, comment: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });
});

describe('reviewListQuerySchema', () => {
  it('acepta sin parámetros (limit por defecto)', () => {
    const result = reviewListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(20);
  });

  it('rechaza un limit fuera de rango', () => {
    expect(reviewListQuerySchema.safeParse({ limit: '999' }).success).toBe(false);
  });
});
