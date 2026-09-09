const { z } = require('zod');

const respondAvailabilityRequestSchema = z.object({
  decision: z.enum(['confirmed', 'declined']),
});

module.exports = { respondAvailabilityRequestSchema };
