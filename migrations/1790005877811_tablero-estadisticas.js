/**
 * Perfil 2.0, Etapa 2 — tablero del día (docs/specs/perfil-2.md §4.4, §7.4).
 *
 * - `clic_como_llegar` en tipo_evento: "Cómo llegar" no registraba nada; el
 *   tablero cuenta como "contactos" los clics de WhatsApp y los de "Cómo
 *   llegar".
 * - `idx_eventos_negocio_tipo_fecha`: "Tu semana" cuenta eventos de UN
 *   negocio por tipo en una ventana de fechas; el índice existente
 *   (tipo, fecha_creacion) obligaba a recorrer los eventos de todos los
 *   negocios.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'clic_como_llegar';
    CREATE INDEX idx_eventos_negocio_tipo_fecha ON eventos (negocio_id, tipo, fecha_creacion);
  `);
};

/**
 * ALTER TYPE ... ADD VALUE no se puede revertir sin recrear el ENUM; el
 * valor queda (sin uso no molesta), igual que en las migraciones anteriores.
 */
exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_eventos_negocio_tipo_fecha;');
};
