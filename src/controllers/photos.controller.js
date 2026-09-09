const fotosService = require('../services/fotos.service');

async function remove(req, res) {
  await fotosService.eliminar(req.user.id, req.params.photoId, req.log);
  res.status(204).send();
}

async function report(req, res) {
  await fotosService.reportar(req.user.id, req.params.photoId);
  res.status(202).send();
}

module.exports = { remove, report };
