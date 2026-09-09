const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  hashToken,
  generateOpaqueToken,
  signAccessToken,
} = require('../../src/services/token.service');

const usuarioIdsCreados = [];
const categoriaIdsCreadas = [];

function correoDePrueba() {
  return `test-${crypto.randomUUID()}@ruteando.test`;
}

function tokenAdmin() {
  // Mismo mecanismo que tests/integration/admin.test.js: register() bloquea
  // role=administrator, así que se firma el JWT directo — authenticate()/
  // requireRole() nunca van a la base de datos.
  return signAccessToken({ id: crypto.randomUUID(), rol: 'administrador' });
}

async function registrar(role, overrides = {}) {
  const email = correoDePrueba();
  const res = await request(app)
    .post('/auth/register')
    .send({ fullName: 'Usuario de Prueba', email, password: 'password123', role, ...overrides });
  usuarioIdsCreados.push(res.body.user.id);
  return res.body;
}

async function crearCategoria() {
  const { rows } = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [
    `Categoría de prueba ${crypto.randomUUID()}`,
  ]);
  categoriaIdsCreadas.push(rows[0].id);
  return rows[0].id;
}

async function otorgarConsentimientosObligatorios(usuarioId) {
  await pool.query(
    `INSERT INTO consentimientos (usuario_id, tipo, texto_version)
     VALUES ($1, 'tratamiento_datos', 'v1'), ($1, 'terminos_condiciones', 'v1')`,
    [usuarioId],
  );
}

async function registrarAsistido(categoryId, overrides = {}) {
  const res = await request(app)
    .post('/auth/assisted-registration')
    .set('Authorization', `Bearer ${tokenAdmin()}`)
    .send({
      vendor: { fullName: 'Vendedor Asistido' },
      business: { name: 'Negocio Asistido', categoryId },
      consentTextVersion: 'v1',
      ...overrides,
    });
  if (res.body?.user?.id) usuarioIdsCreados.push(res.body.user.id);
  return res;
}

afterAll(async () => {
  if (usuarioIdsCreados.length > 0) {
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIdsCreados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIdsCreados]);
  }
  if (categoriaIdsCreadas.length > 0) {
    await pool.query('DELETE FROM categorias WHERE id = ANY($1)', [categoriaIdsCreadas]);
  }
  await pool.end();
});

describe('POST /auth/assisted-registration', () => {
  it('rechaza sin token (401)', async () => {
    const categoryId = await crearCategoria();
    const res = await request(app)
      .post('/auth/assisted-registration')
      .send({
        vendor: { fullName: 'X' },
        business: { name: 'Y', categoryId },
        consentTextVersion: 'v1',
      });
    expect(res.status).toBe(401);
  });

  it('rechaza con un rol no administrador (403)', async () => {
    const categoryId = await crearCategoria();
    const vendor = await registrar('vendor');
    const res = await request(app)
      .post('/auth/assisted-registration')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        vendor: { fullName: 'X' },
        business: { name: 'Y', categoryId },
        consentTextVersion: 'v1',
      });
    expect(res.status).toBe(403);
  });

  it('crea el vendedor y el negocio sin correo ni teléfono (RF-018), negocio en pending', async () => {
    const categoryId = await crearCategoria();
    const res = await registrarAsistido(categoryId);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      fullName: 'Vendedor Asistido',
      role: 'vendor',
      email: null,
    });
    expect(res.body.business).toMatchObject({ name: 'Negocio Asistido', status: 'pending' });
    expect(typeof res.body.claimToken).toBe('string');
    expect(res.body.claimToken.length).toBeGreaterThan(10);
    expect(res.body.claimTokenExpiresAt).toBeTruthy();

    const { rows } = await pool.query(
      'SELECT correo, telefono, contrasena_establecida_en FROM usuarios WHERE id = $1',
      [res.body.user.id],
    );
    expect(rows[0].correo).toBeNull();
    expect(rows[0].telefono).toBeNull();
    expect(rows[0].contrasena_establecida_en).toBeNull();
  });

  it('registra el consentimiento registro_asistido con otorgado_por_terceros=true, sin los dos obligatorios', async () => {
    const categoryId = await crearCategoria();
    const res = await registrarAsistido(categoryId);

    const { rows } = await pool.query(
      'SELECT tipo, otorgado_por_terceros FROM consentimientos WHERE usuario_id = $1',
      [res.body.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tipo: 'registro_asistido', otorgado_por_terceros: true });
  });

  it('acepta correo y teléfono cuando sí vienen', async () => {
    const categoryId = await crearCategoria();
    const email = correoDePrueba();
    const res = await registrarAsistido(categoryId, {
      vendor: { fullName: 'Vendedor Con Correo', email, phone: '3001234567' },
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, phone: '3001234567' });
  });

  it('rechaza con 409 si el correo ya está registrado', async () => {
    const categoryId = await crearCategoria();
    const existente = await registrar('vendor');

    const res = await registrarAsistido(categoryId, {
      vendor: { fullName: 'Otro', email: existente.user.email },
    });
    expect(res.status).toBe(409);
  });

  it('rechaza un categoryId que no existe (422)', async () => {
    const res = await request(app)
      .post('/auth/assisted-registration')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({
        vendor: { fullName: 'X' },
        business: { name: 'Y', categoryId: 999999 },
        consentTextVersion: 'v1',
      });
    expect(res.status).toBe(422);
  });

  it('rechaza sin vendor.fullName (422)', async () => {
    const categoryId = await crearCategoria();
    const res = await request(app)
      .post('/auth/assisted-registration')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ vendor: {}, business: { name: 'Y', categoryId }, consentTextVersion: 'v1' });
    expect(res.status).toBe(422);
  });
});

describe('POST /auth/claim-assisted-account', () => {
  it('fija la contraseña real, marca la cuenta como reclamada y emite tokens sin exigir consentimiento', async () => {
    const categoryId = await crearCategoria();
    const email = correoDePrueba();
    const creado = await registrarAsistido(categoryId, { vendor: { fullName: 'Vendedor', email } });

    const claim = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: creado.body.claimToken, newPassword: 'claveDelVendedor123' });

    expect(claim.status).toBe(200);
    expect(claim.body).toMatchObject({ tokenType: 'Bearer', user: { id: creado.body.user.id } });
    expect(typeof claim.body.accessToken).toBe('string');
    expect(typeof claim.body.refreshToken).toBe('string');

    const { rows } = await pool.query(
      'SELECT contrasena_establecida_en FROM usuarios WHERE id = $1',
      [creado.body.user.id],
    );
    expect(rows[0].contrasena_establecida_en).not.toBeNull();

    // El candado de consentimiento de la Épica 8 se aplica sin cambios:
    // el siguiente login (no el token ya emitido por el claim) lo exige.
    const loginSinConsentir = await request(app)
      .post('/auth/login')
      .send({ email, password: 'claveDelVendedor123' });
    expect(loginSinConsentir.status).toBe(403);

    await otorgarConsentimientosObligatorios(creado.body.user.id);
    const loginConsentido = await request(app)
      .post('/auth/login')
      .send({ email, password: 'claveDelVendedor123' });
    expect(loginConsentido.status).toBe(200);
  });

  it('rechaza reusar el mismo claimToken (un solo uso, 401)', async () => {
    const categoryId = await crearCategoria();
    const creado = await registrarAsistido(categoryId);

    const primero = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: creado.body.claimToken, newPassword: 'primeraClave123' });
    expect(primero.status).toBe(200);

    const segundo = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: creado.body.claimToken, newPassword: 'segundaClave456' });
    expect(segundo.status).toBe(401);
  });

  it('rechaza un claimToken expirado (401)', async () => {
    const categoryId = await crearCategoria();
    const creado = await registrarAsistido(categoryId);

    const tokenCrudo = generateOpaqueToken();
    await pool.query(
      `UPDATE codigos_recuperacion SET codigo_hash = $2, expira_en = now() - interval '1 minute'
       WHERE usuario_id = $1`,
      [creado.body.user.id, hashToken(tokenCrudo)],
    );

    const res = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: tokenCrudo, newPassword: 'claveNueva123' });
    expect(res.status).toBe(401);
  });

  it('rechaza un token que nunca existió (401)', async () => {
    const res = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: generateOpaqueToken(), newPassword: 'claveNueva123' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /admin/users/{userId}/reissue-claim-token', () => {
  it('invalida el token anterior y devuelve uno nuevo (200)', async () => {
    const categoryId = await crearCategoria();
    const creado = await registrarAsistido(categoryId);
    const tokenOriginal = creado.body.claimToken;

    const reissue = await request(app)
      .patch(`/admin/users/${creado.body.user.id}/reissue-claim-token`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(reissue.status).toBe(200);
    expect(reissue.body.claimToken).not.toBe(tokenOriginal);

    const conElViejo = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: tokenOriginal, newPassword: 'claveNueva123' });
    expect(conElViejo.status).toBe(401);

    const conElNuevo = await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: reissue.body.claimToken, newPassword: 'claveNueva123' });
    expect(conElNuevo.status).toBe(200);
  });

  it('rechaza con 409 si la cuenta ya fue reclamada', async () => {
    const categoryId = await crearCategoria();
    const creado = await registrarAsistido(categoryId);

    await request(app)
      .post('/auth/claim-assisted-account')
      .send({ token: creado.body.claimToken, newPassword: 'claveNueva123' });

    const res = await request(app)
      .patch(`/admin/users/${creado.body.user.id}/reissue-claim-token`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(409);
  });

  it('rechaza con 409 sobre un usuario registrado normalmente (ya "reclamado" desde su creación)', async () => {
    const vendor = await registrar('vendor');
    const res = await request(app)
      .patch(`/admin/users/${vendor.user.id}/reissue-claim-token`)
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(409);
  });

  it('responde 404 con un usuario inexistente', async () => {
    const res = await request(app)
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/reissue-claim-token')
      .set('Authorization', `Bearer ${tokenAdmin()}`);
    expect(res.status).toBe(404);
  });

  // 401 sin token / 403 con rol no administrador ya cubiertos por el barrido
  // de todas las rutas /admin/* en admin.test.js.
});
