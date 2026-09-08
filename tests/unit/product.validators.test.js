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

  it('default available es true cuando no se envía', () => {
    const result = productInputSchema.safeParse({ name: 'X', price: 1000 });
    expect(result.data.available).toBe(true);
  });
});
