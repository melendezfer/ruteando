/**
 * Épica 6 — RF-016: defensa en dos capas contra reportar en masa la misma
 * reseña (ver CLAUDE.md sección 10). UNIQUE(resena_id, usuario_id) es la
 * capa principal: un segundo reporte del mismo usuario sobre la misma
 * reseña da 409, no vuelve a tumbarla a 'pendiente' — el límite de
 * ventana (aplicación, ver constants.js) cubre el caso más amplio de una
 * cuenta reportando muchas reseñas distintas rápido.
 *
 * A diferencia de reportes_negocio (RF-025, público/anónimo), reportar
 * una reseña siempre requiere autenticación (hereda el auth global del
 * contrato, sin security:[] en /reviews/{reviewId}/report) — por eso
 * usuario_id es NOT NULL y no hace falta columna ip_origen.
 *
 * atendido_en nullable, mismo patrón que reportes_negocio, para que la
 * Épica 9 pueda "marcar como atendido" sin otra migración.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE reportes_resena (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      resena_id      UUID NOT NULL REFERENCES resenas(id) ON DELETE CASCADE,
      usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      atendido_en    TIMESTAMPTZ,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (resena_id, usuario_id)
    );

    CREATE INDEX idx_reportes_resena_resena ON reportes_resena(resena_id);
    CREATE INDEX idx_reportes_resena_usuario_reciente ON reportes_resena(usuario_id, fecha_creacion);
    CREATE INDEX idx_reportes_resena_pendientes ON reportes_resena(fecha_creacion)
      WHERE atendido_en IS NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS reportes_resena;');
};
