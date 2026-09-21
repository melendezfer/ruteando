/**
 * Ofertas con vigencia (menú/promoción/combo/evento, ver CLAUDE.md,
 * migración productos-tipo-oferta) — petición explícita del usuario antes
 * de esa migración: `productos` no tenía ninguna marca de "cuándo se editó
 * por última vez", y una oferta con vigencia corta (ej. "solo hoy") se
 * beneficia de poder distinguir "se creó hace una semana, sin tocar" de
 * "se acaba de renovar" sin depender de `fecha_creacion` (que nunca
 * cambia). Mismo nombre/criterio que `negocios.fecha_actualizacion`
 * (TIMESTAMPTZ, sin trigger — este proyecto no usa triggers en ningún
 * lado, ver CLAUDE.md; se fija a mano en cada UPDATE, no automático).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE productos
      ADD COLUMN fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE productos DROP COLUMN IF EXISTS fecha_actualizacion;
  `);
};
