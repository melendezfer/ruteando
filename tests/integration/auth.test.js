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
  it('inicia sesión con credenciales correctas (200)', async () => {
    const email = correoDePrueba();
    await registrar({ email });

    const res = await request(app).post('/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
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
    const refreshViejo = registro.body.refreshToken;

    const rotado = await request(app).post('/auth/refresh').send({ refreshToken: refreshViejo });
    expect(rotado.status).toBe(200);
    expect(rotado.body.refreshToken).not.toBe(refreshViejo);

    const reintentoViejo = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshViejo });
    expect(reintentoViejo.status).toBe(401);
  });

  it('reusar un refresh token ya rotado revoca también el token nuevo (detección de robo)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
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
