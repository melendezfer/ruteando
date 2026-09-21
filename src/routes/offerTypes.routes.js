const { Router } = require('express');
const controller = require('../controllers/tiposOferta.controller');

const router = Router();

router.get('/', controller.list);

module.exports = router;
