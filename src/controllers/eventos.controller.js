const eventosService = require('../services/eventos.service');

async function create(req, res) {
  await eventosService.crear({
    usuarioId: req.user?.id,
    ip: req.ip,
    type: req.body.type,
    businessId: req.body.businessId,
    metadata: req.body.metadata,
  });
  res.status(202).send();
}

module.exports = { create };
