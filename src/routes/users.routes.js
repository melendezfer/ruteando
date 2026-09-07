const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middlewares/authenticate');

const router = Router();

router.get('/me', authenticate, usersController.me);

module.exports = router;
