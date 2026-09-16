const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
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

// RF-018 (Épica 8): login() exige los dos consentimientos obligatorios
// antes de emitir tokens — ver el mismo helper en auth.test.js.
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

describe('POST /auth/forgot-password', () => {
  it('responde igual exista o no la cuenta (no enumeración)', async () => {
    const email = correoDePrueba();
    await registrar({ email });

    const existente = await request(app).post('/auth/forgot-password').send({ email });
    const inexistente = await request(app)
      .post('/auth/forgot-password')
      .send({ email: correoDePrueba() });

    expect(existente.status).toBe(inexistente.status);
    expect(existente.body).toEqual(inexistente.body);
  });

  it('genera un código de recuperación hasheado en la base de datos, nunca en texto plano', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    await request(app).post('/auth/forgot-password').send({ email });

    const { rows } = await pool.query(
      'SELECT codigo_hash FROM codigos_recuperacion WHERE usuario_id = $1',
      [registro.body.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo_hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, no el token crudo
  });

  it('invalida el código anterior si se pide uno nuevo para la misma cuenta', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    await request(app).post('/auth/forgot-password').send({ email });
    const { rows: primeraFila } = await pool.query(
      'SELECT id FROM codigos_recuperacion WHERE usuario_id = $1',
      [registro.body.user.id],
    );

    await request(app).post('/auth/forgot-password').send({ email });

    const { rows } = await pool.query(
      'SELECT id, invalidado_en FROM codigos_recuperacion WHERE usuario_id = $1 ORDER BY creado_en',
      [registro.body.user.id],
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === primeraFila[0].id).invalidado_en).not.toBeNull();
    expect(rows.find((r) => r.id !== primeraFila[0].id).invalidado_en).toBeNull();
  });
});

describe('POST /auth/reset-password', () => {
  it('cambia la contraseña con un token válido y revoca las sesiones existentes', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });
    await otorgarConsentimientosObligatorios(registro.body.user.id);
    const refreshPrevio = registro.body.refreshToken;

    // Generamos el token crudo nosotros mismos (en vez de vía HTTP, porque
    // el endpoint real no expone el valor crudo) y lo insertamos como lo
    // haría el servicio, para poder controlarlo en la prueba.
    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'nuevaClaveSegura456' });
    expect(reset.status).toBe(204);

    const loginViejo = await request(app)
      .post('/auth/login')
      .send({ email, password: 'password123' });
    expect(loginViejo.status).toBe(401);

    const loginNuevo = await request(app)
      .post('/auth/login')
      .send({ email, password: 'nuevaClaveSegura456' });
    expect(loginNuevo.status).toBe(200);

    const refreshTrasReset = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshPrevio });
    expect(refreshTrasReset.status).toBe(401);
  });

  it('rechaza reusar el mismo token (un solo uso)', async () => {
    const email = correoDePrueba();
    const registro = await registrar({ email });

    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const primero = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'primeraClaveNueva1' });
    expect(primero.status).toBe(204);

    const segundo = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'segundaClaveNueva2' });
    expect(segundo.status).toBe(401);
  });

  it('rechaza un token expirado (más de 15 minutos)', async () => {
    const registro = await registrar();

    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [registro.body.user.id, hashToken(tokenCrudo)],
    );

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: tokenCrudo, newPassword: 'nuevaClaveSegura456' });
    expect(res.status).toBe(401);
  });

  it('rechaza un token que nunca existió', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: generateOpaqueToken(), newPassword: 'nuevaClaveSegura456' });
    expect(res.status).toBe(401);
  });
});

describe('POST /users/me/change-password (sin RF asociado — distinto del flujo de correo)', () => {
  async function registrarLogueado() {
    const registro = await registrar();
    await otorgarConsentimientosObligatorios(registro.body.user.id);
    const login = await request(app)
      .post('/auth/login')
      .send({ email: registro.body.user.email, password: 'password123' });
    return { userId: registro.body.user.id, email: registro.body.user.email, ...login.body };
  }

  it('cambia la contraseña con la actual correcta (200) y el par de tokens nuevo funciona', async () => {
    const sesion = await registrarLogueado();

    const res = await request(app)
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'nuevaClaveSegura456' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    // El accessToken nuevo sirve de verdad.
    const me = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);

    // La contraseña nueva sirve para loguearse.
    const loginNuevo = await request(app)
      .post('/auth/login')
      .send({ email: sesion.email, password: 'nuevaClaveSegura456' });
    expect(loginNuevo.status).toBe(200);
  });

  it('revoca las demás sesiones — el refreshToken viejo ya no sirve después de cambiar', async () => {
    const sesion = await registrarLogueado();
    const refreshTokenViejo = sesion.refreshToken;

    await request(app)
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'nuevaClaveSegura456' });

    const refresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: refreshTokenViejo });
    expect(refresh.status).toBe(401);
  });

  it('rechaza con 401 si currentPassword no es la actual', async () => {
    const sesion = await registrarLogueado();

    const res = await request(app)
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .send({ currentPassword: 'claveIncorrecta', newPassword: 'nuevaClaveSegura456' });

    expect(res.status).toBe(401);

    // La contraseña original sigue sirviendo — el intento fallido no la tocó.
    const loginOriginal = await request(app)
      .post('/auth/login')
      .send({ email: sesion.email, password: 'password123' });
    expect(loginOriginal.status).toBe(200);
  });

  it('rechaza sin access token (401)', async () => {
    const res = await request(app)
      .post('/users/me/change-password')
      .send({ currentPassword: 'password123', newPassword: 'nuevaClaveSegura456' });
    expect(res.status).toBe(401);
  });

  it('rechaza una newPassword menor a 8 caracteres (422)', async () => {
    const sesion = await registrarLogueado();

    const res = await request(app)
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .send({ currentPassword: 'password123', newPassword: 'corta' });

    expect(res.status).toBe(422);
  });
});
