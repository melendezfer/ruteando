/**
 * CORS_ORIGIN admite una lista separada por comas (ver CLAUDE.md /
 * .env.example) — caso de uso real: probar la app desde un celular en
 * la misma red WiFi que el computador, que necesita agregar su propio
 * origen (por IP de red local) sin dejar de aceptar "localhost" para el
 * uso normal.
 *
 * jest.resetModules() + un valor propio de process.env.CORS_ORIGIN
 * antes de volver a requerir env.js: dotenv (dentro de env.js) nunca
 * sobrescribe una variable que ya está puesta en process.env, así que
 * el valor que este archivo pone se conserva sin importar qué diga
 * .env.development — el resto de las variables obligatorias (
 * DATABASE_URL, JWT_*, etc.) ya están en process.env desde la primera
 * vez que cualquier otro archivo de pruebas requirió env.js/app.js en
 * esta misma corrida, así que la validación del resto del schema sigue
 * pasando igual.
 */
function cargarEnvConCorsOrigin(valor) {
  jest.resetModules();
  process.env.CORS_ORIGIN = valor;
  return require('../../src/config/env');
}

describe('env.js — CORS_ORIGIN', () => {
  const CORS_ORIGIN_ORIGINAL = process.env.CORS_ORIGIN;

  afterEach(() => {
    jest.resetModules();
    process.env.CORS_ORIGIN = CORS_ORIGIN_ORIGINAL;
  });

  it('un solo origen (sin comas) se parsea como un array de un elemento', () => {
    const env = cargarEnvConCorsOrigin('http://localhost:3001');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3001']);
  });

  it('dos orígenes separados por coma se parsean como un array de dos elementos', () => {
    const env = cargarEnvConCorsOrigin('http://localhost:3001,http://192.168.1.23:3001');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3001', 'http://192.168.1.23:3001']);
  });

  it('recorta espacios alrededor de cada origen y descarta entradas vacías (ej. una coma final)', () => {
    const env = cargarEnvConCorsOrigin(' http://localhost:3001 , http://192.168.1.23:3001 ,');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3001', 'http://192.168.1.23:3001']);
  });
});
