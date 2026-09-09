const solicitudesDisponibilidadService = require('../services/solicitudesDisponibilidad.service');

async function getOne(req, res) {
  const result = await solicitudesDisponibilidadService.obtener(req.params.requestId, req.user.id);
  res.status(200).json(result);
}

async function respond(req, res) {
  const result = await solicitudesDisponibilidadService.responder(
    req.params.requestId,
    req.user.id,
    req.body.decision,
  );
  res.status(200).json(result);
}

module.exports = { getOne, respond };
