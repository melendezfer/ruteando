const {
  businessInputSchema,
  locationInputSchema,
  scheduleInputSchema,
  reportInputSchema,
} = require('../../src/validators/business.validators');

describe('businessInputSchema', () => {
  it('acepta un negocio válido', () => {
    expect(businessInputSchema.safeParse({ name: 'Salchipapas', categoryId: 1 }).success).toBe(
      true,
    );
  });

  it('rechaza un categoryId fuera del rango de smallint (categorias.id en schema.sql)', () => {
    // Regresión: 999999 llegaba crudo a Postgres y tiraba un 500
    // ("smallint out of range") en vez de un 422 limpio.
    expect(businessInputSchema.safeParse({ name: 'X', categoryId: 999999 }).success).toBe(false);
  });

  it('rechaza sin name ni categoryId', () => {
    expect(businessInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('locationInputSchema', () => {
  it('acepta coordenadas válidas dentro de Cundinamarca', () => {
    const result = locationInputSchema.safeParse({
      type: 'stall',
      latitude: 4.5789,
      longitude: -74.217,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza latitud fuera del rango absoluto (-90..90)', () => {
    expect(
      locationInputSchema.safeParse({ type: 'fixed', latitude: 95, longitude: -74 }).success,
    ).toBe(false);
  });

  it('rechaza coordenadas válidas globalmente pero fuera de Cundinamarca', () => {
    // Nueva York — lat/lon válidos, pero no tiene sentido para este producto.
    const result = locationInputSchema.safeParse({
      type: 'fixed',
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un tipo de ubicación que no existe', () => {
    expect(
      locationInputSchema.safeParse({ type: 'castle', latitude: 4.6, longitude: -74.2 }).success,
    ).toBe(false);
  });
});

describe('scheduleInputSchema', () => {
  it('acepta un horario válido con días abiertos y cerrados mezclados', () => {
    const result = scheduleInputSchema.safeParse([
      { day: 'monday', openTime: '08:00', closeTime: '18:00' },
      { day: 'sunday', closed: true },
    ]);
    expect(result.success).toBe(true);
  });

  it('rechaza un día abierto (closed: false) sin horas', () => {
    expect(scheduleInputSchema.safeParse([{ day: 'monday', closed: false }]).success).toBe(false);
  });

  it('acepta closeTime anterior a openTime (turno nocturno que cruza medianoche)', () => {
    const result = scheduleInputSchema.safeParse([
      { day: 'monday', openTime: '18:00', closeTime: '02:00' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rechaza closeTime igual a openTime (ambiguo, no representable en este esquema)', () => {
    const result = scheduleInputSchema.safeParse([
      { day: 'monday', openTime: '08:00', closeTime: '08:00' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rechaza dos entradas para el mismo día', () => {
    const result = scheduleInputSchema.safeParse([
      { day: 'monday', openTime: '08:00', closeTime: '12:00' },
      { day: 'monday', closed: true },
    ]);
    expect(result.success).toBe(false);
  });

  it('rechaza más de 7 días', () => {
    const dias = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
      (day) => ({ day, closed: true }),
    );
    dias.push({ day: 'monday', closed: true }); // duplicado a propósito, 8 elementos
    expect(scheduleInputSchema.safeParse(dias).success).toBe(false);
  });
});

describe('reportInputSchema', () => {
  it('rechaza reason vacío', () => {
    expect(reportInputSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('acepta un reason válido', () => {
    expect(reportInputSchema.safeParse({ reason: 'Ya cerró' }).success).toBe(true);
  });
});
