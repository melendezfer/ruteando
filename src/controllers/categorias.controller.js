const categoriasService = require('../services/categorias.service');

async function list(req, res) {
  const categorias = await categoriasService.listar();
  res.status(200).json(categorias);
}

module.exports = { list };
