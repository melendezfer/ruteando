const {
  respondAvailabilityRequestSchema,
} = require('../../src/validators/availabilityRequests.validators');

describe('respondAvailabilityRequestSchema', () => {
  it('acepta confirmed y declined', () => {
    expect(respondAvailabilityRequestSchema.safeParse({ decision: 'confirmed' }).success).toBe(
      true,
    );
    expect(respondAvailabilityRequestSchema.safeParse({ decision: 'declined' }).success).toBe(true);
  });

  it('rechaza sin decision', () => {
    expect(respondAvailabilityRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza un valor fuera del enum', () => {
    expect(respondAvailabilityRequestSchema.safeParse({ decision: 'pending' }).success).toBe(false);
  });
});
