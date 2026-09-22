/**
 * Sin RF asociado — petición directa del usuario: cuando el vendedor
 * cambia el estado disponible/no disponible de un producto, el cliente
 * quiere mostrar "hace cuánto" quedó en ese estado (ver ProductRow) — no
 * alcanza con `fecha_actualizacion` (migración
 * productos-fecha-actualizacion), que se pisa con CUALQUIER edición del
 * producto (precio, nombre, descripción, tipo de oferta...), no solo con
 * un cambio de disponibilidad. Hace falta una columna aparte, que solo
 * se mueve cuando `disponible` de verdad cambia de valor.
 *
 * `disponibilidad_actualizada_en` se fija a mano en cada UPDATE (sin
 * trigger — este proyecto no usa triggers en ningún lado, ver CLAUDE.md),
 * comparando el valor viejo contra el nuevo dentro de la misma sentencia
 * (ver productos.repository.js#actualizar) — así la columna solo se
 * mueve en el UPDATE donde `disponible` efectivamente cambió, no en
 * cualquier otro campo.
 *
 * Default `now()` al agregar la columna: no hay forma de saber cuándo
 * cambió de verdad la disponibilidad de un producto ya existente (solo
 * datos sintéticos/de desarrollo a esta altura), así que se asume "desde
 * que se sembró" — mismo criterio que `fecha_actualizacion`.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE productos
      ADD COLUMN disponibilidad_actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE productos DROP COLUMN IF EXISTS disponibilidad_actualizada_en;
  `);
};
