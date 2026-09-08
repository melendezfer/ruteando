const { productInputSchema } = require('../../src/validators/product.validators');

describe('productInputSchema', () => {
  it('acepta un producto válido', () => {
    expect(productInputSchema.safeParse({ name: 'Salchipapa', price: 8500 }).success).toBe(true);
  });

  it('acepta categoryId ausente/null (productos.categoria_id es nullable)', () => {
    expect(productInputSchema.safeParse({ name: 'Empanada', price: 2000 }).success).toBe(true);
    expect(
      productInputSchema.safeParse({ name: 'Empanada', price: 2000, categoryId: null }).success,
    ).toBe(true);
  });

  it('rechaza sin name ni price', () => {
    expect(productInputSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza price negativo', () => {
    expect(productInputSchema.safeParse({ name: 'X', price: -1 }).success).toBe(false);
  });

  it('rechaza price fuera del rango de DECIMAL(10,2) (productos.precio en schema.sql)', () => {
    expect(productInputSchema.safeParse({ name: 'X', price: 999999999 }).success).toBe(false);
  });

  it('rechaza categoryId fuera del rango de smallint (categorias.id en schema.sql)', () => {
    expect(
      productInputSchema.safeParse({ name: 'X', price: 1000, categoryId: 999999 }).success,
    ).toBe(false);
  });

  it('available queda undefined cuando no se envía (sin .default en el schema)', () => {
    // Regresión: con .default(true) en el schema, un PATCH que no
    // mandaba "available" llegaba al service con el campo ya rellenado
    // en true, y reactivaba en silencio un producto marcado como
    // agotado. El valor por defecto de creación se aplica en
    // productos.service.js, no aquí — ver esa prueba de integración.
    const result = productInputSchema.safeParse({ name: 'X', price: 1000 });
    expect(result.data.available).toBeUndefined();
  });

  it('acepta available explícito (true o false)', () => {
    expect(
      productInputSchema.safeParse({ name: 'X', price: 1000, available: false }).data.available,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ name: 'X', price: 1000, available: true }).data.available,
    ).toBe(true);
  });
});
