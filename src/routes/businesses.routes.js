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
  locationVisibilityInputSchema,
  scheduleInputSchema,
  reportInputSchema,
  phoneVerificationConfirmSchema,
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

// optionalAuthenticate (no pública a secas): ubicacionService.obtenerActual
// usa el token, si viene uno válido, para decidir si quien pregunta es
// el dueño y por lo tanto ve la coordenada exacta sin importar
// showExactLocation (ver CLAUDE.md) — mismo criterio que
// GET /:businessId con rejectionReason.
router.get('/:businessId/location', validarBusinessId, optionalAuthenticate, controller.getLocation);
router.put(
  '/:businessId/location',
  validarBusinessId,
  authenticate,
  validateBody(locationInputSchema),
  controller.putLocation,
);
// "Mostrar mi dirección exacta" vs. "Mostrar solo la zona aproximada" —
// interruptor aparte de PUT .../location a propósito: el vendedor puede
// cambiarlo "cuando quiera" sin tener que volver a mandar type/lat/lng.
router.patch(
  '/:businessId/location/visibility',
  validarBusinessId,
  authenticate,
  validateBody(locationVisibilityInputSchema),
  controller.updateLocationVisibility,
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
// Rediseño de reseñas (ver CLAUDE.md): ya no existe una lista pública de
// reseñas individuales — lo único público es el agregado
// (BusinessProfile.averageRating/reviewCount). Esta ruta reemplaza a la
// antigua GET /:businessId/reviews (pública): ahora requiere autenticación
// y es solo para el dueño del negocio (autorización a nivel de objeto,
// verificada en resenas.service.js#listarFeedbackPrivado).
router.get(
  '/:businessId/feedback',
  validarBusinessId,
  authenticate,
  validateQuery(reviewListQuerySchema),
  controller.listFeedback,
);

router.post('/:businessId/favorite', validarBusinessId, authenticate, controller.markFavorite);
router.delete('/:businessId/favorite', validarBusinessId, authenticate, controller.unmarkFavorite);

// Verificación de teléfono de vendedores (ver CLAUDE.md) — ambas rutas
// solo para el dueño del negocio (autorización a nivel de objeto,
// verificada en verificacionTelefono.service.js, no solo por tener un
// token válido cualquiera).
router.post(
  '/:businessId/phone-verification',
  validarBusinessId,
  authenticate,
  controller.sendPhoneVerification,
);
router.post(
  '/:businessId/phone-verification/confirm',
  validarBusinessId,
  authenticate,
  validateBody(phoneVerificationConfirmSchema),
  controller.confirmPhoneVerification,
);

// Confirmación de disponibilidad en tiempo real (CLAUDE.md, sección 11).
router.post(
  '/:businessId/availability-requests',
  validarBusinessId,
  authenticate,
  controller.requestAvailability,
);

module.exports = router;
