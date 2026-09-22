const { Router } = require('express');
const controller = require('../controllers/adminAuth.controller');
const authenticateAdmin = require('../middlewares/authenticateAdmin');

const router = Router();

/**
 * Fase 1 del panel de administrador (sin RF asociado, ver CLAUDE.md) —
 * `/admin-panel/*`, deliberadamente DISTINTO de `/admin/*` (Épica 9, ya
 * ocupado por el sistema viejo basado en `usuarios.rol = 'administrador'`
 * — ver admin.routes.js). Este prefijo es la base sobre la que las
 * fases 2-5 agregan sus propios módulos (`/admin-panel/<módulo>/...`),
 * cada uno con su propio `requireAdminRole(...)` — nada se monta acá
 * todavía más que auth/me, a propósito: no construir las pantallas de
 * fases futuras es parte explícita del alcance de esta fase.
 */
router.use('/auth', require('./adminAuth.routes'));
router.get('/me', authenticateAdmin, controller.me);

module.exports = router;
