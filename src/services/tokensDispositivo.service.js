const tokensDispositivoRepo = require('../repositories/tokensDispositivo.repository');

async function registrar(usuarioId, token) {
  await tokensDispositivoRepo.registrar({ usuarioId, token });
}

module.exports = { registrar };
