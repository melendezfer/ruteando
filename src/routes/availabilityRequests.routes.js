const { Router } = require('express');
const controller = require('../controllers/availabilityRequests.controller');
const authenticate = require('../middlewares/authenticate');
const { validateBody, validateUuidParam } = require('../middlewares/validate');
const {
  respondAvailabilityRequestSchema,
} = require('../validators/availabilityRequests.validators');

const router = Router();

const validarRequestId = validateUuidParam('requestId');

router.get('/:requestId', validarRequestId, authenticate, controller.getOne);
router.patch(
  '/:requestId/respond',
  validarRequestId,
  authenticate,
  validateBody(respondAvailabilityRequestSchema),
  controller.respond,
);

module.exports = router;
