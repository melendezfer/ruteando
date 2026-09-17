const { z } = require('zod');

// PATCH /users/me (sin RF asociado, ver CLAUDE.md) — deliberadamente sin
// profilePhotoUrl: no existe ningún pipeline de subida de foto de perfil
// de usuario (distinto de las fotos de negocio/producto, Épica 3), sería
// una funcionalidad aparte. Sin .default() en ninguno de los dos campos
// a propósito — un PATCH que omite uno conserva el valor existente
// (mismo criterio que businessInputSchema), resuelto en el controlador.
const updateProfileSchema = z
  .object({
    fullName: z.string().min(1).max(150).optional(),
    phone: z.string().max(20).nullable().optional(),
  })
  .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
    message: 'Debes enviar al menos un campo para actualizar (fullName o phone)',
  });

module.exports = { updateProfileSchema };
