const { resolverCategoriasPorAlias } = require('../../src/config/categoryAliases');

describe('resolverCategoriasPorAlias', () => {
  it('resuelve un alias exacto a su categoría real', () => {
    expect(resolverCategoriasPorAlias('droguerias')).toEqual(['Droguerías']);
  });

  it('es insensible a acentos y mayúsculas', () => {
    expect(resolverCategoriasPorAlias('DROGUERÍAS')).toEqual(['Droguerías']);
    expect(resolverCategoriasPorAlias('Tíntos')).toEqual(['Tintos y café']);
  });

  it('matchea un alias contenido dentro de un texto más largo', () => {
    expect(resolverCategoriasPorAlias('quiero un tinto')).toEqual(['Tintos y café']);
  });

  it('matchea cuando el alias contiene el texto buscado (alias más largo)', () => {
    // "cafe" está contenido en el alias "cafeteria"/"cafeterias" — pero acá
    // se busca literal "cafe", que es en sí mismo una clave del
    // diccionario, así que ya resuelve por coincidencia directa.
    expect(resolverCategoriasPorAlias('cafe')).toEqual(['Tintos y café']);
  });

  it('un alias puede resolver a más de una categoría real', () => {
    expect(resolverCategoriasPorAlias('postres').sort()).toEqual(['Dulces y postres', 'Postres'].sort());
  });

  it('sin coincidencia, devuelve un array vacío', () => {
    expect(resolverCategoriasPorAlias('xyzxyz')).toEqual([]);
  });

  it('con q vacío o solo espacios, devuelve un array vacío', () => {
    expect(resolverCategoriasPorAlias('')).toEqual([]);
    expect(resolverCategoriasPorAlias('   ')).toEqual([]);
  });

  it('con q muy corto (1-2 caracteres), no matchea por contención aunque sea sustring de muchos alias', () => {
    // Sin el umbral mínimo, "a" quedaría "contenido" en casi cualquier
    // alias del diccionario (regresión: ver LARGO_MINIMO_Q).
    expect(resolverCategoriasPorAlias('a')).toEqual([]);
  });
});
