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

  // openNow (sin RF asociado, banner de descubrimiento — familia
  // "Favoritos abiertos ahora"): mismo enum explícito que
  // business.validators.js, no z.coerce.boolean() — ver el comentario en
  // el validador sobre por qué (Boolean("false") es true).
  it('openNow ausente queda undefined, no false', () => {
    const result = favoritesListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.openNow).toBeUndefined();
  });

  it('openNow="true" se transforma a boolean true', () => {
    const result = favoritesListQuerySchema.safeParse({ openNow: 'true' });
    expect(result.success).toBe(true);
    expect(result.data.openNow).toBe(true);
  });

  it('openNow="false" se transforma a boolean false, no a true', () => {
    const result = favoritesListQuerySchema.safeParse({ openNow: 'false' });
    expect(result.success).toBe(true);
    expect(result.data.openNow).toBe(false);
  });

  it('rechaza un openNow que no sea "true"/"false"', () => {
    expect(favoritesListQuerySchema.safeParse({ openNow: 'yes' }).success).toBe(false);
  });
});
