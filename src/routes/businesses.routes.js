const { Router } = require('express');
const controller = require('../controllers/businesses.controller');
const authenticate = require('../middlewares/authenticate');
const { optionalAuthenticate } = authenticate;
const requireRole = require('../middlewares/requireRole');
const { validateBody, validateUuidParam } = require('../middlewares/validate');
const { uploadSingleFoto } = require('../middlewares/upload');
const {
  businessInputSchema,
  locationInputSchema,
  scheduleInputSchema,
  reportInputSchema,
} = require('../validators/business.validators');
const { productInputSchema } = require('../validators/product.validators');

const router = Router();

const validarBusinessId = validateUuidParam('businessId');

router.post(
  '/',
  authenticate,
  requireRole('vendor'),
  validateBody(businessInputSchema),
  controller.create,
);

router.get('/:businessId', validarBusinessId, controller.getOne);
router.patch(
  '/:businessId',
  validarBusinessId,
  authenticate,
  validateBody(businessInputSchema),
  controller.update,
);
router.delete('/:businessId', validarBusinessId, authenticate, controller.remove);

router.get('/:businessId/location', validarBusinessId, controller.getLocation);
router.put(
  '/:businessId/location',
  validarBusinessId,
  authenticate,
  validateBody(locationInputSchema),
  controller.putLocation,
);

router.get('/:businessId/schedule', validarBusinessId, controller.getSchedule);
router.put(
  '/:businessId/schedule',
  validarBusinessId,
  authenticate,
  validateBody(scheduleInputSchema),
  controller.putSchedule,
);

router.post(
  '/:businessId/outdated-reports',
  validarBusinessId,
  optionalAuthenticate,
  validateBody(reportInputSchema),
  controller.reportOutdated,
);

router.post(
  '/:businessId/products',
  validarBusinessId,
  authenticate,
  validateBody(productInputSchema),
  controller.createProduct,
);
router.get('/:businessId/products', validarBusinessId, controller.listProducts);

router.post(
  '/:businessId/photos',
  validarBusinessId,
  authenticate,
  uploadSingleFoto,
  controller.uploadPhoto,
);

module.exports = router;
