const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const registroAsistidoController = require('../controllers/registroAsistido.controller');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');
const { validateBody } = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validators');
const {
  assistedRegistrationInputSchema,
  claimAssistedAccountSchema,
} = require('../validators/registroAsistido.validators');

const router = Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validateBody(logoutSchema), authController.logout);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

// Registro asistido (RF-018, agrupado con la Épica 2) — solo
// administradores pueden ejecutarlo (autorización a nivel de función,
// regla de seguridad #3); el reclamo, en cambio, es público: el token
// opaco es la credencial, igual que /auth/reset-password.
router.post(
  '/assisted-registration',
  authenticate,
  requireRole('administrator'),
  validateBody(assistedRegistrationInputSchema),
  registroAsistidoController.create,
);
router.post(
  '/claim-assisted-account',
  validateBody(claimAssistedAccountSchema),
  registroAsistidoController.claim,
);

module.exports = router;
