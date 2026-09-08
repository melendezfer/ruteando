const { eventInputSchema } = require('../../src/validators/eventos.validators');
const { EVENT_METADATA_MAX_BYTES } = require('../../src/config/constants');

describe('eventInputSchema', () => {
  it('acepta un evento mínimo (solo type)', () => {
    expect(eventInputSchema.safeParse({ type: 'search' }).success).toBe(true);
  });

  it('rechaza un type fuera del enum', () => {
    expect(eventInputSchema.safeParse({ type: 'not_a_real_type' }).success).toBe(false);
  });

  it('rechaza sin type', () => {
    expect(eventInputSchema.safeParse({}).success).toBe(false);
  });

  it('acepta un businessId con formato de UUID válido', () => {
    const result = eventInputSchema.safeParse({
      type: 'business_view',
      businessId: '01a07d3e-41f0-70c8-bce2-227eaec1dc10',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un businessId mal formado (422 antes de llegar a la base de datos)', () => {
    const result = eventInputSchema.safeParse({ type: 'business_view', businessId: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('acepta businessId ausente o null', () => {
    expect(eventInputSchema.safeParse({ type: 'search' }).success).toBe(true);
    expect(eventInputSchema.safeParse({ type: 'search', businessId: null }).success).toBe(true);
  });

  it('acepta metadata como objeto libre (additionalProperties)', () => {
    const result = eventInputSchema.safeParse({
      type: 'search',
      metadata: { query: 'salchipapa', page: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza metadata que pesa más de EVENT_METADATA_MAX_BYTES', () => {
    const result = eventInputSchema.safeParse({
      type: 'search',
      metadata: { big: 'x'.repeat(EVENT_METADATA_MAX_BYTES) },
    });
    expect(result.success).toBe(false);
  });

  it('acepta metadata justo en el límite de tamaño', () => {
    // "x".repeat(n) por sí solo ya pesa más que EVENT_METADATA_MAX_BYTES
    // una vez serializado con las comillas/llaves del JSON — se resta ese
    // margen para probar el límite real, no solo un valor cualquiera que
    // se pase.
    const relleno = 'x'.repeat(EVENT_METADATA_MAX_BYTES - 20);
    const result = eventInputSchema.safeParse({ type: 'search', metadata: { r: relleno } });
    expect(result.success).toBe(true);
  });
});
