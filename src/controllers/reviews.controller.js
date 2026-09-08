const resenasService = require('../services/resenas.service');

async function remove(req, res) {
  await resenasService.eliminar(req.user.id, req.params.reviewId);
  res.status(204).send();
}

async function report(req, res) {
  await resenasService.reportar(req.user.id, req.params.reviewId);
  res.status(202).send();
}

module.exports = { remove, report };
