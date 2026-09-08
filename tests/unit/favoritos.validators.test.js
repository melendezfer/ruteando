const { favoritesListQuerySchema } = require('../../src/validators/favoritos.validators');

describe('favoritesListQuerySchema', () => {
  it('acepta sin parámetros (limit por defecto)', () => {
    const result = favoritesListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(20);
  });

  it('acepta cursor y limit explícitos', () => {
    expect(favoritesListQuerySchema.safeParse({ cursor: 'abc', limit: '5' }).success).toBe(true);
  });

  it('rechaza un limit fuera de rango', () => {
    expect(favoritesListQuerySchema.safeParse({ limit: '999' }).success).toBe(false);
  });
});
