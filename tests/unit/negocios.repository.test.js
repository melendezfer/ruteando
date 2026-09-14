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

/**
 * SKIP_PHONE_VERIFICATION_CHECK (TEMPORAL, SOLO DESARROLLO — ver
 * CLAUDE.md sección 21). `jest.doMock` + `jest.resetModules()` antes de
 * volver a requerir el repositorio: SALTAR_VERIFICACION_TELEFONO se
 * calcula UNA VEZ, al cargar el módulo, así que la única forma de
 * probar las tres combinaciones es forzar un env mockeado distinto y
 * recargar el módulo fresco en cada caso (mismo patrón que
 * env.cors.test.js usa para env.js mismo).
 */
describe('clausulaTelefonoVerificado (SKIP_PHONE_VERIFICATION_CHECK)', () => {
  afterEach(() => {
    jest.dontMock('../../src/config/env');
    jest.resetModules();
  });

  it('sin la bandera activa, exige telefono_verificado = true (comportamiento real, sin cambios)', () => {
    jest.doMock('../../src/config/env', () => ({
      DATABASE_URL: 'postgres://test',
      NODE_ENV: 'development',
      SKIP_PHONE_VERIFICATION_CHECK: false,
    }));
    const repo = require('../../src/repositories/negocios.repository');
    expect(repo.clausulaTelefonoVerificado()).toBe('n.telefono_verificado = true');
  });

  it('con la bandera en true Y NODE_ENV=development, saltea el filtro', () => {
    jest.doMock('../../src/config/env', () => ({
      DATABASE_URL: 'postgres://test',
      NODE_ENV: 'development',
      SKIP_PHONE_VERIFICATION_CHECK: true,
    }));
    const repo = require('../../src/repositories/negocios.repository');
    expect(repo.clausulaTelefonoVerificado()).toBe('true');
  });

  it('defensa en profundidad: la bandera en true con NODE_ENV distinto de development NO saltea el filtro', () => {
    // En la práctica env.js ya impide que esta combinación exista de
    // verdad (su propio .refine() hace fallar el arranque) — este caso
    // simula qué pasaría si ese chequeo se rompiera, para probar que
    // este archivo no confía ciegamente en el booleano y vuelve a mirar
    // NODE_ENV por su cuenta.
    jest.doMock('../../src/config/env', () => ({
      DATABASE_URL: 'postgres://test',
      NODE_ENV: 'production',
      SKIP_PHONE_VERIFICATION_CHECK: true,
    }));
    const repo = require('../../src/repositories/negocios.repository');
    expect(repo.clausulaTelefonoVerificado()).toBe('n.telefono_verificado = true');
  });
});
