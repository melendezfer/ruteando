const { Router } = require('express');
const controller = require('../controllers/photos.controller');
const authenticate = require('../middlewares/authenticate');
const { validateUuidParam } = require('../middlewares/validate');

const router = Router();

router.delete('/:photoId', validateUuidParam('photoId'), authenticate, controller.remove);

module.exports = router;
