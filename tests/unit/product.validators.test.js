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

  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
  // ver CLAUDE.md, migración productos-tipo-oferta.
  describe('offerTypeId / validFrom / validUntil', () => {
    it('un producto de catálogo normal, sin ninguno de los tres, sigue siendo válido', () => {
      expect(productInputSchema.safeParse({ name: 'Salchipapa', price: 8500 }).success).toBe(
        true,
      );
    });

    it('acepta offerTypeId sin tope de 32767 (tipos_oferta.id es SERIAL, no SMALLINT)', () => {
      const result = productInputSchema.safeParse({
        name: 'Promo',
        price: 1000,
        offerTypeId: 999999,
      });
      expect(result.success).toBe(true);
    });

    it('rechaza offerTypeId no positivo', () => {
      expect(
        productInputSchema.safeParse({ name: 'X', price: 1000, offerTypeId: 0 }).success,
      ).toBe(false);
    });

    it('acepta validFrom/validUntil como fechas ISO', () => {
      const result = productInputSchema.safeParse({
        name: 'Promo',
        price: 1000,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-01-02T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
      expect(result.data.validFrom).toBeInstanceOf(Date);
      expect(result.data.validUntil).toBeInstanceOf(Date);
    });

    it('rechaza validUntil <= validFrom', () => {
      const result = productInputSchema.safeParse({
        name: 'Promo',
        price: 1000,
        validFrom: '2026-01-02T00:00:00.000Z',
        validUntil: '2026-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('acepta validFrom sin validUntil ("hasta nuevo aviso")', () => {
      const result = productInputSchema.safeParse({
        name: 'Promo',
        price: 1000,
        validFrom: '2026-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('offerTypeId/validFrom/validUntil quedan undefined cuando no se envían (mismo criterio que available — PATCH parcial real)', () => {
      const result = productInputSchema.safeParse({ name: 'X', price: 1000 });
      expect(result.data.offerTypeId).toBeUndefined();
      expect(result.data.validFrom).toBeUndefined();
      expect(result.data.validUntil).toBeUndefined();
    });
  });
});
