const request = require('supertest');
const app = require('../../src/app');
const env = require('../../src/config/env');

/**
 * Prueba de wiring real (no solo el parseo de env.js, ver
 * tests/unit/env.cors.test.js): confirma que app.js#cors() de verdad usa
 * el array completo que produce env.CORS_ORIGIN, contra el mismo `app`
 * compartido que usa el resto de la suite (sin jest.resetModules(), para
 * no crear un pool de Postgres extra) — portable entre entornos (local
 * usa un valor, CI usa otro, ver ci.yml) leyendo el origen esperado de
 * env.CORS_ORIGIN[0] en vez de asumir un valor fijo.
 */
describe('CORS (múltiples orígenes — ver CLAUDE.md, "acceso LAN para pruebas móviles")', () => {
  it('refleja en Access-Control-Allow-Origin un origen que sí está en la lista configurada', async () => {
    const origenConfigurado = env.CORS_ORIGIN[0];
    const res = await request(app).get('/health').set('Origin', origenConfigurado);
    expect(res.headers['access-control-allow-origin']).toBe(origenConfigurado);
  });

  it('no agrega el header para un origen que no está en la lista', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://origen-no-permitido.test');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
