const consentimientosService = require('../services/consentimientos.service');

async function create(req, res) {
  const consent = await consentimientosService.crear({
    actorUserId: req.user?.id ?? null,
    body: req.body,
    ip: req.ip,
  });
  res.status(201).json(consent);
}

module.exports = { create };
