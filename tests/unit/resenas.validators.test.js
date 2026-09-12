const {
  reviewInputSchema,
  reviewListQuerySchema,
  REVIEW_TAG_API_VALUES,
} = require('../../src/validators/resenas.validators');

describe('reviewInputSchema', () => {
  it('acepta un rating válido sin etiquetas ni comentario', () => {
    expect(reviewInputSchema.safeParse({ rating: 5 }).success).toBe(true);
  });

  it('acepta rating + tags + privateComment', () => {
    const resultado = reviewInputSchema.safeParse({
      rating: 3,
      tags: ['long_wait', 'good_price'],
      privateComment: 'Regular, pero volvería',
    });
    expect(resultado.success).toBe(true);
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

  it('rechaza un privateComment más largo de 1000 caracteres', () => {
    expect(
      reviewInputSchema.safeParse({ rating: 4, privateComment: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('rechaza una etiqueta que no existe en el catálogo', () => {
    expect(reviewInputSchema.safeParse({ rating: 4, tags: ['inventada'] }).success).toBe(false);
  });

  it('rechaza etiquetas repetidas', () => {
    expect(
      reviewInputSchema.safeParse({ rating: 4, tags: ['good_price', 'good_price'] }).success,
    ).toBe(false);
  });

  it('acepta las 8 etiquetas del catálogo a la vez, sin repetir', () => {
    expect(REVIEW_TAG_API_VALUES).toHaveLength(8);
    expect(reviewInputSchema.safeParse({ rating: 4, tags: REVIEW_TAG_API_VALUES }).success).toBe(
      true,
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
