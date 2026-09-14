/**
 * SKIP_PHONE_VERIFICATION_CHECK (TEMPORAL, SOLO DESARROLLO — ver CLAUDE.md
 * sección 21 y el comentario completo en src/config/env.js): sin
 * proveedor de SMS conectado en ningún ambiente, esta bandera deja pasar
 * negocios sin teléfono verificado en /businesses, /businesses/nearby y
 * /businesses/zones cuando NODE_ENV=development. Mismo patrón de
 * jest.resetModules() + process.env directo que env.cors.test.js: dotenv
 * (dentro de env.js) nunca sobrescribe una variable que ya está puesta en
 * process.env, así que el valor que cada prueba pone se conserva sin
 * importar qué diga .env.development.
 */
function cargarEnvCon({ nodeEnv, skipPhoneVerification }) {
  jest.resetModules();
  if (nodeEnv !== undefined) process.env.NODE_ENV = nodeEnv;
  // Nunca `delete`: dotenv (dentro de env.js) solo respeta una variable
  // que YA está presente en process.env, sin importar su valor — un
  // `delete` la dejaría "ausente" de nuevo y dotenv la repondría leyendo
  // .env.development, que en este mismo entorno puede tener
  // SKIP_PHONE_VERIFICATION_CHECK=true puesto a propósito (ver CLAUDE.md
  // sección 21) — justo lo que este archivo prueba, así que un `delete`
  // haría que el caso "sin la variable" no probara lo que dice probar.
  process.env.SKIP_PHONE_VERIFICATION_CHECK = skipPhoneVerification ?? '';
  return require('../../src/config/env');
}

describe('env.js — SKIP_PHONE_VERIFICATION_CHECK', () => {
  const NODE_ENV_ORIGINAL = process.env.NODE_ENV;
  const SKIP_ORIGINAL = process.env.SKIP_PHONE_VERIFICATION_CHECK;

  afterEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = NODE_ENV_ORIGINAL;
    if (SKIP_ORIGINAL === undefined) {
      delete process.env.SKIP_PHONE_VERIFICATION_CHECK;
    } else {
      process.env.SKIP_PHONE_VERIFICATION_CHECK = SKIP_ORIGINAL;
    }
  });

  it('sin la variable, queda en false (comportamiento real de producción, el valor seguro por defecto)', () => {
    const env = cargarEnvCon({ nodeEnv: 'development' });
    expect(env.SKIP_PHONE_VERIFICATION_CHECK).toBe(false);
  });

  it('cualquier valor que no sea exactamente "true" también queda en false', () => {
    const env = cargarEnvCon({ nodeEnv: 'development', skipPhoneVerification: 'yes' });
    expect(env.SKIP_PHONE_VERIFICATION_CHECK).toBe(false);
  });

  it('"true" con NODE_ENV=development sí lo activa', () => {
    const env = cargarEnvCon({ nodeEnv: 'development', skipPhoneVerification: 'true' });
    expect(env.SKIP_PHONE_VERIFICATION_CHECK).toBe(true);
  });

  it('"true" con NODE_ENV=production hace fallar la validación del arranque, no se ignora en silencio', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    cargarEnvCon({ nodeEnv: 'production', skipPhoneVerification: 'true' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const fieldErrors = errorSpy.mock.calls[0][1];
    expect(fieldErrors).toHaveProperty('SKIP_PHONE_VERIFICATION_CHECK');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
