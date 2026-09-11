const authService = require('../services/auth.service');
const passwordResetService = require('../services/passwordReset.service');

// Express 5 reenvía automáticamente cualquier rechazo de una promesa al
// error handler central — no hace falta try/catch en cada controlador.

async function register(req, res) {
  const result = await authService.register({ ...req.body, ip: req.ip });
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

async function refresh(req, res) {
  const result = await authService.refresh(req.body);
  res.status(200).json(result);
}

async function logout(req, res) {
  await authService.logout({ refreshToken: req.body.refreshToken, usuarioId: req.user.id });
  res.status(204).send();
}

async function forgotPassword(req, res) {
  await passwordResetService.solicitarRecuperacion(req.body);
  res
    .status(202)
    .json({ message: 'Si el correo está registrado, se envió un enlace de recuperación.' });
}

async function resetPassword(req, res) {
  await passwordResetService.restablecerContrasena(req.body);
  res.status(204).send();
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
