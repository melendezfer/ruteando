/**
 * Épica 2 — RF-025 no tenía tabla ni ruta en la especificación original
 * (Documento 09/14). Se agrega aquí junto con su endpoint OpenAPI, mismo
 * patrón que RF-003 en la Épica 1. atendido_en queda nullable para que la
 * Épica 9 pueda "marcar como atendido" sin una tabla nueva.
 *
 * usuario_id es nullable: el reporte puede venir de un usuario anónimo (sin
 * token) — RF-025 dice "cualquier usuario", no "cualquier usuario
 * autenticado".
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE reportes_negocio (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo         TEXT NOT NULL,
      atendido_en    TIMESTAMPTZ,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_reportes_negocio_negocio ON reportes_negocio(negocio_id);
    CREATE INDEX idx_reportes_negocio_pendientes ON reportes_negocio(fecha_creacion)
      WHERE atendido_en IS NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS reportes_negocio;');
};
