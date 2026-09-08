const { Router } = require('express');
const controller = require('../controllers/consentimientos.controller');
const { tryAuthenticate } = require('../middlewares/authenticate');
const { validateBody } = require('../middlewares/validate');
const { consentInputSchema } = require('../validators/consentimientos.validators');

const router = Router();

router.post('/', tryAuthenticate, validateBody(consentInputSchema), controller.create);

module.exports = router;
