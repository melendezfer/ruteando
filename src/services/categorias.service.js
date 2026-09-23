const categoriasRepo = require('../repositories/categorias.repository');

// Expansión de alcance (ver CLAUDE.md sección 31): RUTEANDO ya no es
// exclusivamente comida callejera — `tipo` distingue qué tan genérico es
// el catálogo de un negocio de esa categoría (Carta/Productos/Servicios,
// ver client/src/lib/catalog/catalog-label.ts). Mismo criterio de
// mapeo español(DB)->inglés(API) que el resto del proyecto
// (STATUS_DB_TO_API, DAY_DB_TO_API en business.mapper.js).
const TIPO_CATEGORIA_DB_TO_API = {
  alimentos: 'food',
  productos: 'goods',
  servicios: 'services',
};

function toApiCategory(row) {
  return {
    id: row.id,
    name: row.nombre,
    // Ícono y color PROPIOS de la categoría (migración categorias-icono-color):
    // la única fuente de verdad de cómo se dibuja una categoría en
    // cualquier pantalla — el frontend ya no deduce nada por `type` ni
    // calcula colores por hash del id.
    icon: row.icono,
    color: row.color,
    displayOrder: row.orden_visualizacion,
    type: TIPO_CATEGORIA_DB_TO_API[row.tipo],
  };
}

async function listar() {
  const categorias = await categoriasRepo.listar();
  return categorias.map(toApiCategory);
}

module.exports = { listar, toApiCategory, TIPO_CATEGORIA_DB_TO_API };
