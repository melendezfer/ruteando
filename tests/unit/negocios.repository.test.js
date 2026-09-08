const { escaparComodinesLike } = require('../../src/repositories/negocios.repository');

describe('escaparComodinesLike', () => {
  it('deja texto normal intacto', () => {
    expect(escaparComodinesLike('Salchipapas Doña Ana')).toBe('Salchipapas Doña Ana');
  });

  it('escapa "%" para que no actúe como comodín', () => {
    expect(escaparComodinesLike('50% de descuento')).toBe('50\\% de descuento');
  });

  it('escapa "_" para que no actúe como comodín (matchea cualquier carácter en LIKE)', () => {
    expect(escaparComodinesLike('combo_especial')).toBe('combo\\_especial');
  });

  it('escapa "\\" primero, para que no se lea como inicio de una secuencia de escape', () => {
    expect(escaparComodinesLike('a\\b')).toBe('a\\\\b');
  });

  it('un intento de "q=%" para matchear todo se convierte en un patrón que busca un "%" literal', () => {
    expect(escaparComodinesLike('%')).toBe('\\%');
  });
});
