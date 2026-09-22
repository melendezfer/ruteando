const { Router } = require('express');
const controller = require('../controllers/adminAuth.controller');
const authenticateAdmin = require('../middlewares/authenticateAdmin');
const { validateBody } = require('../middlewares/validate');
const {
  adminLoginSchema,
  adminRefreshSchema,
  adminLogoutSchema,
} = require('../validators/adminAuth.validators');

const router = Router();

router.post('/login', validateBody(adminLoginSchema), controller.login);
router.post('/refresh', validateBody(adminRefreshSchema), controller.refresh);
router.post('/logout', authenticateAdmin, validateBody(adminLogoutSchema), controller.logout);

module.exports = router;
