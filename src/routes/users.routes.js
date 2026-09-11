const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middlewares/authenticate');
const { validateBody, validateQuery } = require('../middlewares/validate');
const { favoritesListQuerySchema } = require('../validators/favoritos.validators');
const { reviewListQuerySchema } = require('../validators/resenas.validators');
const { deviceTokenInputSchema } = require('../validators/deviceTokens.validators');

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

module.exports = router;
