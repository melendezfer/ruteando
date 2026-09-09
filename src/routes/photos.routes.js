const { Router } = require('express');
const controller = require('../controllers/photos.controller');
const authenticate = require('../middlewares/authenticate');
const { validateUuidParam } = require('../middlewares/validate');

const router = Router();

const validarPhotoId = validateUuidParam('photoId');

router.delete('/:photoId', validarPhotoId, authenticate, controller.remove);
router.post('/:photoId/report', validarPhotoId, authenticate, controller.report);

module.exports = router;
