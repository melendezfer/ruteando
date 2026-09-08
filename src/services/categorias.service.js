const categoriasRepo = require('../repositories/categorias.repository');

function toApiCategory(row) {
  return {
    id: row.id,
    name: row.nombre,
    icon: row.icono,
    displayOrder: row.orden_visualizacion,
  };
}

async function listar() {
  const categorias = await categoriasRepo.listar();
  return categorias.map(toApiCategory);
}

module.exports = { listar };
