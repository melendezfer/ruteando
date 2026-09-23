/**
 * Modalidad de negocio a 3 valores (sin RF asociado, petición directa del
 * usuario — rehacer íconos/colores/modalidad, PR 1 de 3). Hasta acá
 * `movilidad_negocio` tenía 2 valores (migración movilidad-negocio):
 * 'ambulante' (se desplaza) y 'local_fijo' (punto de venta cerrado). Faltaba
 * el caso más común de la comida callejera: el puesto que siempre está en
 * el mismo sitio de la calle pero no es un local (carrito estacionado,
 * toldo en la esquina) — 'fijo_via_publica'.
 *
 * No hace falta migrar datos ni renombrar nada: los dos valores ya
 * existentes conservan exactamente su significado, solo se AGREGA el
 * tercero. Ninguna fila existente cambia de valor — no hay forma honesta
 * de inferir, para un negocio real ya registrado como 'ambulante', si en
 * realidad es un puesto fijo en la vía (`ubicaciones.tipo = 'puesto'` es
 * una pista, pero la llena el vendedor en el registro con un significado
 * distinto — tipo de punto, no modalidad — así que no se usa para
 * reclasificar en silencio). Cada vendedor lo corrige desde su perfil.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE movilidad_negocio ADD VALUE IF NOT EXISTS 'fijo_via_publica' AFTER 'ambulante';`);
};

/**
 * Postgres no permite quitar un valor de un ENUM: se recrea el tipo con
 * los 2 valores originales, pasando cualquier 'fijo_via_publica' a
 * 'local_fijo' (lo más cercano: también es un punto que no se mueve).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    UPDATE negocios SET movilidad = 'local_fijo' WHERE movilidad = 'fijo_via_publica';
    ALTER TABLE negocios ALTER COLUMN movilidad DROP DEFAULT;
    ALTER TYPE movilidad_negocio RENAME TO movilidad_negocio_old;
    CREATE TYPE movilidad_negocio AS ENUM ('ambulante', 'local_fijo');
    ALTER TABLE negocios ALTER COLUMN movilidad TYPE movilidad_negocio USING movilidad::text::movilidad_negocio;
    ALTER TABLE negocios ALTER COLUMN movilidad SET DEFAULT 'ambulante';
    DROP TYPE movilidad_negocio_old;
  `);
};
