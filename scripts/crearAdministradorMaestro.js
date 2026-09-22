#!/usr/bin/env node
/**
 * Bootstrap del primer `administrador_maestro` (Fase 1 del panel de
 * administrador — sin RF asociado, ver CLAUDE.md). No existe ningún
 * endpoint de autorregistro para `administradores` a propósito —
 * cualquiera podría autoasignarse el rol de mayor privilegio del
 * sistema si existiera. La única vía es este script, corrido a mano
 * (con acceso directo a DATABASE_URL, mismo nivel de confianza que
 * cambiar `negocios.plan` a mano por SQL — ver CLAUDE.md, sección 11).
 *
 * Una vez que exista al menos un `administrador_maestro`, ese admin
 * puede crear delegados (`administrador`) desde una pantalla de fases
 * futuras — este script vuelve a ser necesario solo si hay que crear
 * OTRO maestro o recuperar el acceso si el único existente se pierde.
 *
 * Uso:
 *   node scripts/crearAdministradorMaestro.js "Nombre Completo" correo@ejemplo.com "contraseña"
 */
require('../src/config/env');
const argon2 = require('argon2');
const pool = require('../src/config/db');

async function main() {
  const [, , nombreCompleto, correo, password] = process.argv;

  if (!nombreCompleto || !correo || !password) {
    console.error(
      'Uso: node scripts/crearAdministradorMaestro.js "Nombre Completo" correo@ejemplo.com "contraseña"',
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exitCode = 1;
    return;
  }

  const existente = await pool.query('SELECT id FROM administradores WHERE correo = $1', [correo]);
  if (existente.rows.length > 0) {
    console.error(`Ya existe un administrador con el correo ${correo}.`);
    process.exitCode = 1;
    return;
  }

  const contrasenaHash = await argon2.hash(password);
  const { rows } = await pool.query(
    `INSERT INTO administradores (nombre_completo, correo, contrasena_hash, rol)
     VALUES ($1, $2, $3, 'administrador_maestro')
     RETURNING id, correo, rol`,
    [nombreCompleto, correo, contrasenaHash],
  );

  console.log('Administrador maestro creado:', rows[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
