/**
 * Épica 9 (moderación de fotos, gap dejado pendiente desde la Épica 6):
 * fotos no tenía estado_moderacion — toda foto subida era visible de
 * inmediato. Se agrega la columna con default 'aprobada' para no cambiar
 * el comportamiento de lo que ya está subido; solo una foto reportada
 * pasa a 'pendiente' (ver fotos.service.js#reportar) y sale de
 * fotos.repository.js#listarAprobadasPorNegocio hasta que un
 * administrador la revise.
 *
 * reportes_foto calca reportes_resena (Épica 6): UNIQUE(foto_id,
 * usuario_id) como primera capa contra reportes duplicados del mismo
 * usuario sobre la misma foto (segunda capa: límite de tasa por origen,
 * en aplicación, igual que reportes_resena).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE fotos ADD COLUMN estado_moderacion estado_moderacion NOT NULL DEFAULT 'aprobada';

    CREATE INDEX idx_fotos_moderacion_pendiente ON fotos(fecha_creacion)
      WHERE estado_moderacion = 'pendiente';

    CREATE TABLE reportes_foto (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      foto_id        UUID NOT NULL REFERENCES fotos(id) ON DELETE CASCADE,
      usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (foto_id, usuario_id)
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS reportes_foto;
    DROP INDEX IF EXISTS idx_fotos_moderacion_pendiente;
    ALTER TABLE fotos DROP COLUMN IF EXISTS estado_moderacion;
  `);
};
