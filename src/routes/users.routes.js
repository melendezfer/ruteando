const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middlewares/authenticate');
const { validateBody, validateQuery } = require('../middlewares/validate');
const { favoritesListQuerySchema } = require('../validators/favoritos.validators');
const { reviewListQuerySchema } = require('../validators/resenas.validators');
const { deviceTokenInputSchema } = require('../validators/deviceTokens.validators');
const {
  accountDeletionRequestInputSchema,
} = require('../validators/solicitudEliminacionCuenta.validators');

const router = Router();

router.get('/me', authenticate, usersController.me);
router.get(
  '/me/favorites',
  authenticate,
  validateQuery(favoritesListQuerySchema),
  usersController.listFavorites,
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
