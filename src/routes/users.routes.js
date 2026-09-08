const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middlewares/authenticate');
const { validateQuery } = require('../middlewares/validate');
const { favoritesListQuerySchema } = require('../validators/favoritos.validators');

const router = Router();

router.get('/me', authenticate, usersController.me);
router.get(
  '/me/favorites',
  authenticate,
  validateQuery(favoritesListQuerySchema),
  usersController.listFavorites,
);
router.get('/me/consents', authenticate, usersController.listConsents);

module.exports = router;
