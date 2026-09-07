const horariosRepo = require('../repositories/horarios.repository');
const { obtenerCrudoOFallar, verificarPropietario } = require('./negocios.service');
const { toApiScheduleDay, DAY_API_TO_DB } = require('./business.mapper');

async function obtener(negocioId) {
  await obtenerCrudoOFallar(negocioId);
  const dias = await horariosRepo.listar(negocioId);
  return dias.map(toApiScheduleDay);
}

async function reemplazar(usuarioId, negocioId, diasInput) {
  const negocio = await obtenerCrudoOFallar(negocioId);
  verificarPropietario(negocio, usuarioId);

  const diasParaGuardar = diasInput.map((dia) => ({
    dia: DAY_API_TO_DB[dia.day],
    horaApertura: dia.closed ? null : dia.openTime,
    horaCierre: dia.closed ? null : dia.closeTime,
    cerrado: dia.closed,
  }));

  await horariosRepo.reemplazarTodos(negocioId, diasParaGuardar);

  const guardados = await horariosRepo.listar(negocioId);
  return guardados.map(toApiScheduleDay);
}

module.exports = { obtener, reemplazar };
