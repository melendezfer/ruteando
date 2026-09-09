const { Router } = require('express');
const controller = require('../controllers/businesses.controller');
const authenticate = require('../middlewares/authenticate');
const { optionalAuthenticate } = authenticate;
const requireRole = require('../middlewares/requireRole');
const { validateBody, validateQuery, validateUuidParam } = require('../middlewares/validate');
const { uploadSingleFoto } = require('../middlewares/upload');
const {
  businessInputSchema,
  locationInputSchema,
  scheduleInputSchema,
  reportInputSchema,
  businessListQuerySchema,
  businessNearbyQuerySchema,
} = require('../validators/business.validators');
const { productInputSchema } = require('../validators/product.validators');
const { reviewInputSchema, reviewListQuerySchema } = require('../validators/resenas.validators');

const router = Router();

const validarBusinessId = validateUuidParam('businessId');

router.post(
  '/',
  authenticate,
  requireRole('vendor'),
  validateBody(businessInputSchema),
  controller.create,
);

// IMPORTANTE: /nearby (y GET '/') deben registrarse ANTES de
// GET /:businessId — si no, Express intentaría matchear "nearby" como el
// parámetro :businessId (validarBusinessId lo rechazaría con 404 antes de
// llegar siquiera al controlador correcto).
router.get('/nearby', validateQuery(businessNearbyQuerySchema), controller.nearby);
router.get('/', validateQuery(businessListQuerySchema), controller.list);

// optionalAuthenticate (no authenticate a secas): la ruta sigue siendo
// pública — un token ausente no la bloquea — pero si viene uno válido,
// perfilNegocio.service.js lo usa para decidir si quien pregunta es el
// dueño y puede ver rejectionReason (RF-020). Un token presente pero
// inválido/expirado sí se rechaza con 401 (mismo criterio que RF-025 y
// POST /events: no degradar en silencio a anónimo).
router.get('/:businessId', validarBusinessId, optionalAuthenticate, controller.getOne);
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

router.post(
  '/:businessId/reviews',
  validarBusinessId,
  authenticate,
  validateBody(reviewInputSchema),
  controller.createReview,
);
router.get(
  '/:businessId/reviews',
  validarBusinessId,
  validateQuery(reviewListQuerySchema),
  controller.listReviews,
);

router.post('/:businessId/favorite', validarBusinessId, authenticate, controller.markFavorite);
router.delete('/:businessId/favorite', validarBusinessId, authenticate, controller.unmarkFavorite);

module.exports = router;
