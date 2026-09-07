const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/businesses', require('./businesses.routes'));

module.exports = router;
