const { Router } = require('express');
const controller = require('../controllers/admin.controller');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');
const { validateBody, validateQuery, validateUuidParam } = require('../middlewares/validate');
const {
  adminListQuerySchema,
  rejectBusinessSchema,
  moderationDecisionSchema,
} = require('../validators/admin.validators');

const router = Router();

// Regla de seguridad #3 (autorización a nivel de función): una sola vez a
// nivel de router, no repetido en cada ruta — así ninguna ruta nueva que
// se agregue después a este archivo puede quedar sin proteger por
// descuido. authenticate primero: requireRole necesita req.user.role, que
// solo existe si authenticate ya corrió.
router.use(authenticate, requireRole('administrator'));

const validateListQuery = validateQuery(adminListQuerySchema);

router.get('/businesses/pending', validateListQuery, controller.listPendingBusinesses);
router.patch(
  '/businesses/:businessId/approve',
  validateUuidParam('businessId'),
  controller.approveBusiness,
);
router.patch(
  '/businesses/:businessId/reject',
  validateUuidParam('businessId'),
  validateBody(rejectBusinessSchema),
  controller.rejectBusiness,
);

router.get('/reviews/reported', validateListQuery, controller.listReportedReviews);
router.patch(
  '/reviews/:reviewId/moderate',
  validateUuidParam('reviewId'),
  validateBody(moderationDecisionSchema),
  controller.moderateReview,
);

// Épica 9 (moderación de fotos, gap dejado pendiente desde la Épica 6):
// simétrico a reseñas arriba.
router.get('/photos/reported', validateListQuery, controller.listReportedPhotos);
router.patch(
  '/photos/:photoId/moderate',
  validateUuidParam('photoId'),
  validateBody(moderationDecisionSchema),
  controller.moderatePhoto,
);

// Endpoints faltantes en la especificación original, agregados en esta
// épica (ver CLAUDE.md, sección 10).
router.patch('/users/:userId/suspend', validateUuidParam('userId'), controller.suspendUser);

// Registro asistido (RF-018, Épica 2) — reemitir un token de reclamo para
// un vendedor que perdió o nunca recibió el que se le entregó en la
// creación (POST /auth/assisted-registration). 409 si la cuenta ya fue
// reclamada, ver registroAsistido.service.js#reemitirTokenReclamo.
router.patch(
  '/users/:userId/reissue-claim-token',
  validateUuidParam('userId'),
  controller.reissueClaimToken,
);

router.get('/outdated-reports', validateListQuery, controller.listOutdatedReports);
router.patch(
  '/outdated-reports/:reportId/resolve',
  validateUuidParam('reportId'),
  controller.resolveOutdatedReport,
);

// "Solicitar eliminación de mi cuenta" (Configuración, Épica F6) — ver
// CLAUDE.md. "resolve" acá solo marca la solicitud como atendida, igual
// que outdated-reports arriba: NO borra los datos del usuario por sí
// solo — el borrado real de datos personales sigue siendo un proceso
// aparte (manual, o de la Épica 9 cuando se aborde), a propósito.
router.get(
  '/account-deletion-requests',
  validateListQuery,
  controller.listAccountDeletionRequests,
);
router.patch(
  '/account-deletion-requests/:requestId/resolve',
  validateUuidParam('requestId'),
  controller.resolveAccountDeletionRequest,
);

router.get('/metrics', controller.metrics);
router.get('/reports/export', controller.exportReports);

module.exports = router;
