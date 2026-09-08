const { Router } = require('express');
const controller = require('../controllers/eventos.controller');
const { optionalAuthenticate } = require('../middlewares/authenticate');
const { validateBody } = require('../middlewares/validate');
const { eventInputSchema } = require('../validators/eventos.validators');

const router = Router();

router.post('/', optionalAuthenticate, validateBody(eventInputSchema), controller.create);

module.exports = router;
