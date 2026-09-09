/**
 * Épica 9: GET /admin/reviews/reported lista resenas.estado_moderacion =
 * 'pendiente' (toda reseña nueva nace pendiente, no solo las reportadas —
 * ver CLAUDE.md). Sin este índice, esa consulta sería un seq scan sobre
 * toda la tabla a medida que crece — mismo criterio que
 * idx_reportes_negocio_pendientes (Épica 2): índice parcial, porque solo
 * importa poder encontrar rápido las pendientes, no todas las filas.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX idx_resenas_pendientes ON resenas(fecha_creacion)
      WHERE estado_moderacion = 'pendiente';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_resenas_pendientes;');
};
