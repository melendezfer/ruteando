/**
 * Registro asistido (RF-018, agrupado con la Épica 2): un negocio creado
 * por un administrador en nombre de un vendedor todavía necesita una fila
 * real en usuarios (negocios.usuario_id sigue NOT NULL) — pero ese
 * vendedor puede no tener correo. Verificado en vivo contra Postgres 18
 * antes de escribir esta migración: quitar NOT NULL de correo basta, el
 * UNIQUE existente no choca entre múltiples filas con correo NULL
 * (Postgres trata cada NULL como distinto en una restricción UNIQUE) — no
 * hace falta ningún índice único parcial ni otro mecanismo.
 *
 * contrasena_establecida_en distingue "ya reclamó su cuenta y fijó su
 * propia contraseña" de "todavía tiene el hash aleatorio no derivable que
 * le puso el registro asistido" — sin esto, un administrador podría
 * reemitir un token de "fijar contraseña" en cualquier momento, incluso
 * para un vendedor que lleva meses usando su cuenta con su propia
 * contraseña. register() la rellena de una vez (ahí el usuario sí fija su
 * propia contraseña de inmediato); el registro asistido la deja NULL a
 * propósito. Se backfillea con fecha_creacion para todo usuario existente
 * — todos se registraron por la vía normal hasta ahora, ninguno debe
 * quedar marcado como "sin reclamar".
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios ALTER COLUMN correo DROP NOT NULL;
    ALTER TABLE usuarios ADD COLUMN contrasena_establecida_en TIMESTAMPTZ;
    UPDATE usuarios SET contrasena_establecida_en = fecha_creacion;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios DROP COLUMN IF EXISTS contrasena_establecida_en;
    ALTER TABLE usuarios ALTER COLUMN correo SET NOT NULL;
  `);
};
