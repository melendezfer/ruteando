const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/businesses', require('./businesses.routes'));
router.use('/products', require('./products.routes'));
router.use('/photos', require('./photos.routes'));
router.use('/categories', require('./categories.routes'));

module.exports = router;
