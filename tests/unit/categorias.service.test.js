const { toApiCategory, TIPO_CATEGORIA_DB_TO_API } = require('../../src/services/categorias.service');

describe('toApiCategory', () => {
  it('mapea una fila de categorias (español) al contrato Category (inglés)', () => {
    const row = { id: 1, nombre: 'Arepas', icono: null, orden_visualizacion: 0, tipo: 'alimentos' };

    expect(toApiCategory(row)).toEqual({
      id: 1,
      name: 'Arepas',
      icon: null,
      displayOrder: 0,
      type: 'food',
    });
  });

  it('mapea los 3 tipos de categoría (expansión de alcance, ver CLAUDE.md sección 31)', () => {
    expect(toApiCategory({ id: 1, nombre: 'X', tipo: 'alimentos' }).type).toBe('food');
    expect(toApiCategory({ id: 2, nombre: 'Y', tipo: 'productos' }).type).toBe('goods');
    expect(toApiCategory({ id: 3, nombre: 'Z', tipo: 'servicios' }).type).toBe('services');
  });
});

describe('TIPO_CATEGORIA_DB_TO_API', () => {
  it('cubre exactamente los 3 valores del enum tipo_categoria', () => {
    expect(TIPO_CATEGORIA_DB_TO_API).toEqual({
      alimentos: 'food',
      productos: 'goods',
      servicios: 'services',
    });
  });
});
