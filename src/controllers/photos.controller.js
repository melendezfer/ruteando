const fotosService = require('../services/fotos.service');

async function remove(req, res) {
  await fotosService.eliminar(req.user.id, req.params.photoId, req.log);
  res.status(204).send();
}

module.exports = { remove };
