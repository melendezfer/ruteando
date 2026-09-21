const tiposOfertaService = require('../services/tiposOferta.service');

async function list(req, res) {
  const tipos = await tiposOfertaService.listarActivos();
  res.status(200).json(tipos);
}

module.exports = { list };
