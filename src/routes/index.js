const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/businesses', require('./businesses.routes'));
router.use('/products', require('./products.routes'));
router.use('/photos', require('./photos.routes'));
router.use('/categories', require('./categories.routes'));
router.use('/events', require('./events.routes'));
router.use('/reviews', require('./reviews.routes'));
router.use('/consents', require('./consents.routes'));

module.exports = router;
