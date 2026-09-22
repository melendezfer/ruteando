const crypto = require('node:crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const env = require('../../src/config/env');
const { hashToken, generateOpaqueToken } = require('../../src/services/token.service');
const auditoriaService = require('../../src/services/auditoria.service');

const administradorIdsCreados = [];

function correoDePrueba() {
  return `admin-test-${crypto.randomUUID()}@ruteando.test`;
}

/**
 * Inserta directo por SQL (no hay endpoint de autorregistro de
 * administradores a propósito, ver scripts/crearAdministradorMaestro.js
 * — cualquiera podría autoasignarse el rol de mayor privilegio si
 * existiera). `rol` default 'administrador' (delegado), mismo criterio
 * que el resto de la suite del proyecto: crear el dato mínimo
 * necesario, no pasar por una API que no existe.
 */
async function crearAdministrador({ rol = 'administrador', password = 'password123' } = {}) {
  const correo = correoDePrueba();
  const contrasenaHash = await argon2.hash(password);
  const { rows } = await pool.query(
    `INSERT INTO administradores (nombre_completo, correo, contrasena_hash, rol)
     VALUES ('Admin de Prueba', $1, $2, $3)
     RETURNING *`,
    [correo, contrasenaHash, rol],
  );
  administradorIdsCreados.push(rows[0].id);
  return { row: rows[0], correo, password };
}

async function login(correo, password) {
  return request(app).post('/admin-panel/auth/login').send({ email: correo, password });
}

afterAll(async () => {
  if (administradorIdsCreados.length > 0) {
    await pool.query('DELETE FROM auditoria_admin WHERE administrador_id = ANY($1)', [
      administradorIdsCreados,
    ]);
    await pool.query('DELETE FROM administradores WHERE id = ANY($1)', [administradorIdsCreados]);
  }
  await pool.end();
});

describe('POST /admin-panel/auth/login', () => {
  it('inicia sesión con credenciales correctas y devuelve AdminAuthTokens (200)', async () => {
    const { correo, password } = await crearAdministrador();

    const res = await login(correo, password);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      admin: { email: correo, role: 'admin' },
    });
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('mapea rol administrador_maestro a "super_admin" en la API', async () => {
    const { correo, password } = await crearAdministrador({ rol: 'administrador_maestro' });

    const res = await login(correo, password);

    expect(res.body.admin.role).toBe('super_admin');
  });

  it('rechaza una contraseña incorrecta con el mismo mensaje genérico', async () => {
    const { correo } = await crearAdministrador({ password: 'password123' });

    const res = await login(correo, 'contraseña-equivocada');

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Credenciales inválidas');
  });

  it('rechaza un correo que no existe con el MISMO status y forma que una contraseña incorrecta', async () => {
    const res = await login('no-existe-de-verdad@ruteando.test', 'lo-que-sea');

    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Credenciales inválidas');
  });

  it('rechaza el login de una cuenta desactivada (activo = false)', async () => {
    const { row, correo, password } = await crearAdministrador();
    await pool.query('UPDATE administradores SET activo = false WHERE id = $1', [row.id]);

    const res = await login(correo, password);

    expect(res.status).toBe(401);
  });

  it('rechaza un body inválido (422)', async () => {
    const res = await request(app).post('/admin-panel/auth/login').send({ email: 'no-es-un-correo' });
    expect(res.status).toBe(422);
  });
});

describe('POST /admin-panel/auth/refresh', () => {
  it('rota el refresh token: el nuevo par funciona y el viejo deja de servir', async () => {
    const { correo, password } = await crearAdministrador();
    const sesion = await login(correo, password);
    const refreshViejo = sesion.body.refreshToken;

    const rotado = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: refreshViejo });
    expect(rotado.status).toBe(200);
    expect(rotado.body.refreshToken).not.toBe(refreshViejo);

    const reintentoViejo = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: refreshViejo });
    expect(reintentoViejo.status).toBe(401);
  });

  it('reusar un refresh token ya rotado revoca también el token nuevo (detección de robo, RFC 9700)', async () => {
    const { correo, password } = await crearAdministrador();
    const sesion = await login(correo, password);
    const refreshOriginal = sesion.body.refreshToken;

    const primeraRotacion = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: refreshOriginal });
    const refreshNuevo = primeraRotacion.body.refreshToken;

    await request(app).post('/admin-panel/auth/refresh').send({ refreshToken: refreshOriginal });

    const intentoConElNuevo = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: refreshNuevo });

    expect(intentoConElNuevo.status).toBe(401);
  });

  it('rechaza un refresh token expirado', async () => {
    const { row } = await crearAdministrador();
    const tokenExpirado = generateOpaqueToken();
    await pool.query(
      `INSERT INTO tokens_refresco_administrador (administrador_id, token_hash, expira_en)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [row.id, hashToken(tokenExpirado)],
    );

    const res = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: tokenExpirado });
    expect(res.status).toBe(401);
  });

  it('rechaza un refresh token que nunca existió', async () => {
    const res = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: generateOpaqueToken() });
    expect(res.status).toBe(401);
  });

  // No hay chequeo de consentimiento acá (a diferencia de /auth/refresh)
  // — Ley 1581/RF-018 no le aplica a una cuenta de administrador.
});

describe('POST /admin-panel/auth/logout', () => {
  it('revoca el refresh token indicado; refrescar con él después falla', async () => {
    const { correo, password } = await crearAdministrador();
    const sesion = await login(correo, password);

    const logout = await request(app)
      .post('/admin-panel/auth/logout')
      .set('Authorization', `Bearer ${sesion.body.accessToken}`)
      .send({ refreshToken: sesion.body.refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: sesion.body.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('rechaza logout sin access token (401)', async () => {
    const res = await request(app)
      .post('/admin-panel/auth/logout')
      .send({ refreshToken: 'lo-que-sea' });
    expect(res.status).toBe(401);
  });

  it('no revoca el refresh token de otro administrador (autorización a nivel de objeto)', async () => {
    const admin1 = await crearAdministrador();
    const admin2 = await crearAdministrador();
    const sesion1 = await login(admin1.correo, admin1.password);
    const sesion2 = await login(admin2.correo, admin2.password);

    // admin2 intenta revocar el refresh token de admin1 con SU PROPIO
    // access token — no debe tener efecto.
    await request(app)
      .post('/admin-panel/auth/logout')
      .set('Authorization', `Bearer ${sesion2.body.accessToken}`)
      .send({ refreshToken: sesion1.body.refreshToken });

    const refreshDeAdmin1 = await request(app)
      .post('/admin-panel/auth/refresh')
      .send({ refreshToken: sesion1.body.refreshToken });
    expect(refreshDeAdmin1.status).toBe(200);
  });
});

describe('GET /admin-panel/me', () => {
  it('devuelve el perfil propio con un access token válido', async () => {
    const { correo, password } = await crearAdministrador({ rol: 'administrador_maestro' });
    const sesion = await login(correo, password);

    const res = await request(app)
      .get('/admin-panel/me')
      .set('Authorization', `Bearer ${sesion.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: correo, role: 'super_admin', active: true });
  });

  it('rechaza sin header Authorization (401)', async () => {
    const res = await request(app).get('/admin-panel/me');
    expect(res.status).toBe(401);
  });

  // Regla de seguridad clave: un access token de un USUARIO NORMAL
  // (vendedor/consumidor/el "administrador" viejo de usuarios.rol) no
  // debe servir acá — firmado con un secreto distinto (ver env.js).
  it('rechaza un access token válido de un usuario normal (secreto de firma distinto)', async () => {
    const tokenDeUsuario = jwt.sign({ sub: 'user-1', role: 'administrator' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });

    const res = await request(app)
      .get('/admin-panel/me')
      .set('Authorization', `Bearer ${tokenDeUsuario}`);

    expect(res.status).toBe(401);
  });

  it('rechaza un token expirado (401)', async () => {
    const { row } = await crearAdministrador();
    const tokenExpirado = jwt.sign(
      { sub: row.id, role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 },
      env.ADMIN_JWT_ACCESS_SECRET,
    );

    const res = await request(app)
      .get('/admin-panel/me')
      .set('Authorization', `Bearer ${tokenExpirado}`);

    expect(res.status).toBe(401);
  });
});

// Fase 1 (sin RF asociado, ver CLAUDE.md): la tabla de auditoría no
// tiene ninguna pantalla propia todavía (fases futuras la usan) — se
// prueba directo contra el servicio, mismo criterio que "que quede
// lista aunque las pantallas se construyan después".
describe('auditoria.service.js#registrar (Fase 1 — base para fases futuras)', () => {
  it('registra quién hizo qué acción sobre qué entidad y cuándo', async () => {
    const { row } = await crearAdministrador();

    await auditoriaService.registrar({
      administradorId: row.id,
      accion: 'aprobar_negocio',
      entidadTipo: 'negocio',
      entidadId: '01a0c974-3c59-7d66-8566-c325efbe76e4',
      detalle: { motivo: 'cumple los requisitos' },
    });

    const { rows } = await pool.query(
      'SELECT * FROM auditoria_admin WHERE administrador_id = $1',
      [row.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      accion: 'aprobar_negocio',
      entidad_tipo: 'negocio',
      entidad_id: '01a0c974-3c59-7d66-8566-c325efbe76e4',
    });
    expect(rows[0].detalle).toEqual({ motivo: 'cumple los requisitos' });
    expect(rows[0].fecha).toBeTruthy();
  });

  it('sobrevive al borrado del administrador (ON DELETE SET NULL, no CASCADE)', async () => {
    const { row } = await crearAdministrador();

    await auditoriaService.registrar({
      administradorId: row.id,
      accion: 'suspender_usuario',
      entidadTipo: 'usuario',
      entidadId: 'x',
    });

    await pool.query('DELETE FROM administradores WHERE id = $1', [row.id]);
    // Ya no hace falta borrarlo en afterAll — evita un segundo DELETE
    // sobre una fila que ya no existe.
    administradorIdsCreados.splice(administradorIdsCreados.indexOf(row.id), 1);

    const { rows } = await pool.query(
      "SELECT * FROM auditoria_admin WHERE accion = 'suspender_usuario' AND entidad_id = 'x'",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].administrador_id).toBeNull();

    // Esta fila ya no tiene administrador_id (quedó NULL a propósito, es
    // justo lo que prueba este caso) — afterAll no puede limpiarla por
    // administradorIdsCreados, así que se borra acá mismo para no dejar
    // residuo entre corridas de la suite.
    await pool.query('DELETE FROM auditoria_admin WHERE id = $1', [rows[0].id]);
  });
});
