/**
 * Límite de abuso en RF-025 (reportes anónimos sin auth obligatoria):
 * hace falta un origen para poder contar cuántos reportes recientes vino
 * de la misma fuente cuando no hay usuario_id. Mismo tipo de columna que
 * consentimientos.ip_origen en schema.sql.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql('ALTER TABLE reportes_negocio ADD COLUMN ip_origen INET;');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('ALTER TABLE reportes_negocio DROP COLUMN IF EXISTS ip_origen;');
};
