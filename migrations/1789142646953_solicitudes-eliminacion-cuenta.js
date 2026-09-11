/**
 * "Solicitar eliminación de mi cuenta y mis datos" (Configuración, Épica
 * F6) — petición del usuario, sin RF asociado en los Documentos 05-15.
 * La cuenta NO se elimina al instante (Ley 1581 exige un plazo de
 * procesamiento, no un borrado inmediato) — esto solo registra la
 * solicitud, visible para el equipo administrador hasta que la Épica 9
 * (o un proceso manual mientras tanto) la procese de verdad.
 *
 * usuario_id con ON DELETE SET NULL (no CASCADE): el día que la cuenta
 * se elimine de verdad, esta fila debe SOBREVIVIR — es lo que separa el
 * motivo/comentario (retroalimentación de producto) de los datos
 * personales que sí se van a borrar. Sin este diseño, un ON DELETE
 * CASCADE se llevaría la retroalimentación junto con la cuenta,
 * exactamente lo que se pidió evitar.
 *
 * motivo es un enum nuevo (no uno de los 8 originales del Documento 07)
 * — mismo criterio que estado_negocio ganó el valor 'rechazado' después:
 * un ENUM real, no TEXT libre, porque son opciones fijas y cerradas (a
 * diferencia de reportes_negocio.motivo, que sí es texto libre).
 *
 * El índice único parcial (WHERE atendido_en IS NULL) impide que la
 * misma cuenta tenga dos solicitudes activas a la vez — una vez
 * atendida (y la cuenta real ya no exista), una fila nueva ya no tiene
 * con qué usuario_id chocar de todas formas.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE motivo_eliminacion_cuenta AS ENUM (
      'ya_no_lo_necesito',
      'no_encontre_lo_que_buscaba',
      'problema_tecnico',
      'otro'
    );

    CREATE TABLE solicitudes_eliminacion_cuenta (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo         motivo_eliminacion_cuenta,
      comentario     TEXT,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
      atendido_en    TIMESTAMPTZ
    );

    CREATE INDEX idx_solicitudes_eliminacion_usuario ON solicitudes_eliminacion_cuenta(usuario_id);

    CREATE UNIQUE INDEX idx_solicitudes_eliminacion_activa_por_usuario
      ON solicitudes_eliminacion_cuenta(usuario_id)
      WHERE atendido_en IS NULL AND usuario_id IS NOT NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS solicitudes_eliminacion_cuenta;
    DROP TYPE IF EXISTS motivo_eliminacion_cuenta;
  `);
};
