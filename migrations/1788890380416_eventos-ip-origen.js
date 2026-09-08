/**
 * Épica 5 — POST /events (RF-013/023) es público (auth opcional, mismo
 * patrón que RF-025): sin usuario_id, el único origen disponible para
 * limitar abuso es la IP. eventos no tenía columna para eso (a diferencia
 * de reportes_negocio, que ya la tiene desde la Épica 2) — mismo tipo que
 * consentimientos.ip_origen / reportes_negocio.ip_origen en schema.sql.
 *
 * Los índices parciales (uno por usuario_id, otro por ip_origen, cada uno
 * solo sobre las filas donde esa columna no es null — igual que el índice
 * único parcial de ubicaciones.es_actual) son necesarios acá y no lo
 * fueron para reportes_negocio: eventos es "de alto volumen" por diseño
 * (ver comentario en schema.sql), así que contar eventos recientes por
 * origen sin índice degrada con el tiempo en una tabla que solo crece.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE eventos ADD COLUMN ip_origen INET;

    CREATE INDEX idx_eventos_usuario_reciente ON eventos(usuario_id, fecha_creacion)
      WHERE usuario_id IS NOT NULL;
    CREATE INDEX idx_eventos_ip_reciente ON eventos(ip_origen, fecha_creacion)
      WHERE ip_origen IS NOT NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_eventos_ip_reciente;
    DROP INDEX IF EXISTS idx_eventos_usuario_reciente;
    ALTER TABLE eventos DROP COLUMN IF EXISTS ip_origen;
  `);
};
