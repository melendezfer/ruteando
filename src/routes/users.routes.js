const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middlewares/authenticate');
const { validateBody, validateQuery } = require('../middlewares/validate');
const { favoritesListQuerySchema } = require('../validators/favoritos.validators');
const { reviewListQuerySchema } = require('../validators/resenas.validators');
const { deviceTokenInputSchema } = require('../validators/deviceTokens.validators');
const { myBusinessesListQuerySchema } = require('../validators/business.validators');
const { changePasswordSchema } = require('../validators/auth.validators');
const { updateProfileSchema } = require('../validators/usuarios.validators');
const {
  accountDeletionRequestInputSchema,
} = require('../validators/solicitudEliminacionCuenta.validators');

const router = Router();

router.get('/me', authenticate, usersController.me);
// PATCH /users/me (sin RF asociado, ver CLAUDE.md) — deliberadamente
// solo fullName/phone, sin profilePhotoUrl (sin pipeline de subida de
// foto de perfil de usuario todavía).
router.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  usersController.updateMe,
);
router.get(
  '/me/favorites',
  authenticate,
  validateQuery(favoritesListQuerySchema),
  usersController.listFavorites,
);
// Pantalla de inicio por rol (sin RF asociado, ver CLAUDE.md) — un
// vendedor necesita saber si ya tiene un negocio (y cuál/cuáles) para
// decidir a dónde lo manda "/" en vez del mapa.
router.get(
  '/me/businesses',
  authenticate,
  validateQuery(myBusinessesListQuerySchema),
  usersController.listBusinesses,
);
// Cambiar contraseña estando logueado (sin RF asociado — ver CLAUDE.md
// sección 39/40): distinto del flujo de recuperación por correo
// (POST /auth/reset-password) — acá la prueba de identidad es la
// contraseña actual, no un token de un solo uso.
router.post(
  '/me/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  usersController.changePassword,
);
router.get('/me/consents', authenticate, usersController.listConsents);
router.get(
  '/me/reviews',
  authenticate,
  validateQuery(reviewListQuerySchema),
  usersController.listReviews,
);
router.post(
  '/me/device-tokens',
  authenticate,
  validateBody(deviceTokenInputSchema),
  usersController.registerDeviceToken,
);

// "Solicitar eliminación de mi cuenta y mis datos" (Configuración,
// Épica F6) — ver CLAUDE.md. La cuenta NO se elimina acá; el DELETE
// /users/me que ya estaba declarado en la especificación original nunca
// tuvo ruta ni implementación (gap encontrado leyendo este archivo, ver
// CLAUDE.md) y sigue así, sin tocar — este es un endpoint nuevo y
// distinto, deliberadamente sin semántica de "borrado inmediato".
router.post(
  '/me/account-deletion-request',
  authenticate,
  validateBody(accountDeletionRequestInputSchema),
  usersController.requestAccountDeletion,
);

module.exports = router;
