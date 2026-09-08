const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const env = require('../../src/config/env');
const { hashToken, generateOpaqueToken } = require('../../src/services/token.service');

const usuarioIdsCreados = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

async function registrar(overrides = {}) {
  const body = {
    fullName: 'Usuario de Prueba',
    email: correoDePrueba(),
    password: 'password123',
    role: 'consumer',
    ...overrides,
  };
  const res = await request(app).post('/auth/register').send(body);
  usuarioIdsCreados.push(res.body.user.id);
  return res;
}

/**
 * RF-018 (Épica 8): login()/refresh() ahora exigen los dos
 * consentimientos obligatorios antes de emitir tokens — register() no
 * cambia y sigue emitiéndolos de inmediato (por eso las pruebas de
 * "POST /auth/register" de arriba no necesitan esto), pero cualquier
 * prueba de esta suite que además llame a login()/refresh() sí. Inserta
 * directo por SQL en vez de pasar por POST /consents (que tiene su
 * propia suite en consentimientos.test.js) para no acoplar esta suite a
 * ese endpoint.
 */
async function otorgarConsentimientosObligatorios(usuarioId) {
  await pool.query(
    `INSERT INTO consentimientos (usuario_id, tipo, texto_version)
     VALUES ($1, 'tratamiento_datos', 'v1'), ($1, 'terminos_condiciones', 'v1')`,
    [usuarioId],
  );
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  await pool.end();
});

describe('POST /auth/register', () => {
  it('crea la cuenta y devuelve AuthTokens (201)', async () => {
    const email = correoDePrueba();
    const res = await registrar({ email });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      user: { email, role: 'consumer', active: true },
    });
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rechaza un correo duplicado (409)', async () => {
    const email = correoDePrueba();
    await registrar({ email });

    const res = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Otro', email, password: 'password123', role: 'consumer' });

    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('rechaza un body inválido con formato RFC 9457 (422)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ fullName: 'A', email: 'no-es-correo', password: '123', role: 'consumer' });

    expect(res.status).toBe(422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('nunca guarda ni devuelve la contraseña en texto plano', async () => {
    const email = correoDePrueba();
    const res = await registrar({ email });

    expect(JSON.stringify(res.body)).not.toContain('password123');

    const { rows } = await pool.query('SELECT contrasena_hash FROM usuarios WHERE correo = $1', [
      email,
    ]);
    expect(rows[0].contrasena_hash).not.toBe('password123');
    expect(rows[0].contrasena_hash).toMatch(/^\$argon2id\$/);
  });
});

describe('POST /auth/login', () => {
  it('inicia sesión con credenciales correctas y consentimiento completo (200)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    await otorgarConsentimientosObligatorios(registro.body.user.id);

    const res = await request(app).post('/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('rechaza con 403 (RFC 9457, type consent-required) cuando falta consentimiento obligatorio', async () => {
    const email = correoDePrueba();
    await registrar({ email }); // sin otorgar ningún consentimiento

    const res = await request(app).post('/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.type).toBe('https://api.ciudadverdegastronomica.co/errors/consent-required');
    expect(res.body.missingConsentTypes.sort()).toEqual(['data_processing', 'terms_conditions']);
  });

  it('rechaza con 403 cuando falta solo UNO de los dos consentimientos obligatorios', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    await pool.query(
      `INSERT INTO consentimientos (usuario_id, tipo, texto_version) VALUES ($1, 'tratamiento_datos', 'v1')`,
      [registro.body.user.id],
    );

    const res = await request(app).post('/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.missingConsentTypes).toEqual(['terms_conditions']);
  });

  it('rechaza una contraseña incorrecta con el mismo mensaje genérico', async () => {
    const email = correoDePrueba();
    await registrar({ email });

    const res = await request(app).post('/auth/login').send({ email, password: 'incorrecta' });

    expect(res.status).toBe(401);
  });

  it('rechaza un correo que no existe con el MISMO status y forma que una contraseña incorrecta', async () => {
    const inexistente = await request(app)
      .post('/auth/login')
      .send({ email: correoDePrueba(), password: 'cualquiera123' });

    const email = correoDePrueba();
    await registrar({ email });
    const incorrecta = await request(app)
      .post('/auth/login')
      .send({ email, password: 'incorrecta' });

    expect(inexistente.status).toBe(401);
    expect(incorrecta.status).toBe(401);
    expect(inexistente.body).toEqual(incorrecta.body);
  });

  it('rechaza el login de una cuenta suspendida (activo = false)', async () => {
    const email = correoDePrueba();
    const res = await registrar({ email });
    await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [res.body.user.id]);

    const login = await request(app).post('/auth/login').send({ email, password: 'password123' });

    expect(login.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rota el refresh token: el nuevo par funciona y el viejo deja de servir', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    await otorgarConsentimientosObligatorios(registro.body.user.id);
    const refreshViejo = registro.body.refreshToken;

    const rotado = await request(app).post('/auth/refresh').send({ refreshToken: refreshViejo });
    expect(rotado.status).toBe(200);
    expect(rotado.body.refreshToken).not.toBe(refreshViejo);

    const reintentoViejo = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshViejo });
    expect(reintentoViejo.status).toBe(401);
  });

  it('rechaza con 403 cuando falta consentimiento, y el refresh token original NO se rota ni se invalida', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email }); // sin otorgar consentimiento
    const refreshToken = registro.body.refreshToken;

    const rechazado = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(rechazado.status).toBe(403);
    expect(rechazado.body.type).toBe(
      'https://api.ciudadverdegastronomica.co/errors/consent-required',
    );

    // El mismo token original, después de otorgar el consentimiento, sigue
    // sirviendo — prueba de que el 403 anterior no lo tocó (regla 4: la
    // rotación solo ocurre cuando el intercambio efectivamente tiene éxito).
    await otorgarConsentimientosObligatorios(registro.body.user.id);
    const exitoso = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(exitoso.status).toBe(200);
  });

  it('reusar un refresh token ya rotado revoca también el token nuevo (detección de robo)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    await otorgarConsentimientosObligatorios(registro.body.user.id);
    const refreshOriginal = registro.body.refreshToken;

    const primeraRotacion = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshOriginal });
    const refreshNuevo = primeraRotacion.body.refreshToken;

    // Reuso del token original ya rotado.
    await request(app).post('/auth/refresh').send({ refreshToken: refreshOriginal });

    const intentoConElNuevo = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshNuevo });

    expect(intentoConElNuevo.status).toBe(401);
  });

  it('rechaza un refresh token expirado', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const tokenExpirado = generateOpaqueToken();
    await pool.query(
      `INSERT INTO tokens_refresco (usuario_id, token_hash, expira_en)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [registro.body.user.id, hashToken(tokenExpirado)],
    );

    const res = await request(app).post('/auth/refresh').send({ refreshToken: tokenExpirado });
    expect(res.status).toBe(401);
  });

  it('rechaza un refresh token que nunca existió', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: generateOpaqueToken() });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revoca el refresh token indicado; refrescar con él después falla', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ refreshToken: registro.body.refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: registro.body.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('rechaza logout sin access token (401)', async () => {
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'lo-que-sea' });
    expect(res.status).toBe(401);
  });

  it('no revoca el refresh token de otro usuario (autorización a nivel de objeto)', async () => {
    const registroA = await registrar();
    const registroB = await registrar();
    await otorgarConsentimientosObligatorios(registroB.body.user.id);

    // El usuario A intenta cerrar sesión pasando el refresh token de B.
    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${registroA.body.accessToken}`)
      .send({ refreshToken: registroB.body.refreshToken });

    // El refresh token de B debe seguir funcionando.
    const refreshDeB = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: registroB.body.refreshToken });
    expect(refreshDeB.status).toBe(200);
  });
});

describe('GET /users/me', () => {
  it('devuelve el perfil propio con un access token válido', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${registro.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('rechaza sin header Authorization (401)', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('rechaza un token inválido / con firma incorrecta (401)', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer esto-no-es-un-jwt-valido');
    expect(res.status).toBe(401);
  });

  it('rechaza un token expirado (401)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const tokenExpirado = jwt.sign(
      { sub: registro.body.user.id, role: 'consumer', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
    );

    const res = await request(app).get('/users/me').set('Authorization', `Bearer ${tokenExpirado}`);
    expect(res.status).toBe(401);
  });
});
