const registroAsistidoService = require('../services/registroAsistido.service');

async function create(req, res) {
  const result = await registroAsistidoService.crear(req.body);
  res.status(201).json(result);
}

async function claim(req, res) {
  const result = await registroAsistidoService.reclamar(req.body);
  res.status(200).json(result);
}

module.exports = { create, claim };
