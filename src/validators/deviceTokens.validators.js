const { z } = require('zod');

const deviceTokenInputSchema = z.object({
  token: z.string().min(1).max(4096),
});

module.exports = { deviceTokenInputSchema };
