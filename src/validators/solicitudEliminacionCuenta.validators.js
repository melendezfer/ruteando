const { z } = require('zod');

// POST /users/me/account-deletion-request — todo opcional, se puede
// omitir y seguir con la solicitud igual (ver CLAUDE.md). `.default({})`
// en el objeto completo (no solo en cada campo) porque un POST sin body
// en absoluto deja req.body en `undefined` (no `{}`) — sin esto, zod
// rechaza el objeto entero como 422 en vez de tratarlo como "nada que
// validar".
const accountDeletionRequestInputSchema = z
  .object({
    reason: z
      .enum(['no_longer_needed', 'could_not_find_what_i_needed', 'technical_problem', 'other'])
      .nullable()
      .optional(),
    comment: z.string().max(1000).nullable().optional(),
  })
  .default({});

module.exports = { accountDeletionRequestInputSchema };
