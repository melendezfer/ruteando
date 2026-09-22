/**
 * Campo nuevo, sin RF asociado (petición directa del usuario, ver
 * CLAUDE.md): asientos_disponibles indica si el negocio ofrece
 * bancas/asientos para que el cliente coma o espere en el sitio — mismo
 * patrón exacto que entrega_propia (migración entrega-propia-negocio):
 * vive en `negocios` (una propiedad del negocio mismo, sin relación con
 * su ubicación ni con ningún otro campo), se declara al registrar y se
 * puede cambiar en cualquier momento desde el perfil.
 *
 * Default false: un negocio existente (solo datos sintéticos/de
 * desarrollo a esta altura) no declaró nada al respecto, así que no hay
 * base para asumir que sí ofrece asientos.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios ADD COLUMN asientos_disponibles BOOLEAN NOT NULL DEFAULT false;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios DROP COLUMN IF EXISTS asientos_disponibles;
  `);
};
