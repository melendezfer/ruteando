const productosService = require('../services/productos.service');
const fotosService = require('../services/fotos.service');

async function getOne(req, res) {
  const product = await productosService.obtener(req.params.productId);
  res.status(200).json(product);
}

async function update(req, res) {
  const product = await productosService.actualizar(req.user.id, req.params.productId, req.body);
  res.status(200).json(product);
}

async function remove(req, res) {
  await productosService.eliminar(req.user.id, req.params.productId, req.log);
  res.status(204).send();
}

async function uploadPhoto(req, res) {
  const photo = await fotosService.subirParaProducto(
    req.user.id,
    req.params.productId,
    req.file,
    req.log,
  );
  res.status(201).json(photo);
}

module.exports = { getOne, update, remove, uploadPhoto };
