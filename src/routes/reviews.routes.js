const { Router } = require('express');
const controller = require('../controllers/reviews.controller');
const authenticate = require('../middlewares/authenticate');
const { validateUuidParam } = require('../middlewares/validate');

const router = Router();

const validarReviewId = validateUuidParam('reviewId');

router.delete('/:reviewId', validarReviewId, authenticate, controller.remove);
router.post('/:reviewId/report', validarReviewId, authenticate, controller.report);

module.exports = router;
