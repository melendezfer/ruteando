/**
 * Confirmación de disponibilidad en tiempo real (CLAUDE.md, sección 11 —
 * mejora futura, ahora asignada). No existía ningún concepto de "token de
 * dispositivo" en el proyecto (verificado por grep antes de escribir esta
 * migración) — tokens_dispositivo es uno-a-muchos con usuarios, mismo
 * criterio que tokens_refresco (tabla aparte, no una columna en usuarios).
 *
 * solicitudes_disponibilidad usa expiración perezosa, igual que
 * codigos_recuperacion: decision/respondida_en solo se escriben cuando el
 * vendedor responde de verdad — "expirada" nunca se guarda, se calcula al
 * leer comparando expira_en contra el reloj (sin cron, no existe
 * infraestructura de scheduling en este proyecto).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE decision_disponibilidad AS ENUM ('confirmada', 'rechazada');

    CREATE TABLE tokens_dispositivo (
      id                  UUID PRIMARY KEY DEFAULT uuidv7(),
      usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token               TEXT NOT NULL UNIQUE,
      fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_tokens_dispositivo_usuario ON tokens_dispositivo(usuario_id);

    CREATE TABLE solicitudes_disponibilidad (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
      expira_en      TIMESTAMPTZ NOT NULL,
      decision       decision_disponibilidad,
      respondida_en  TIMESTAMPTZ
    );
    CREATE INDEX idx_solicitudes_disponibilidad_negocio
      ON solicitudes_disponibilidad(negocio_id, fecha_creacion);
    CREATE INDEX idx_solicitudes_disponibilidad_usuario
      ON solicitudes_disponibilidad(usuario_id, fecha_creacion);
    -- Acelera "¿hay una confirmación fresca de este negocio?" (se consulta
    -- en cada lectura del perfil público) — mismo criterio que los índices
    -- parciales de las colas de moderación de la Épica 9.
    CREATE INDEX idx_solicitudes_disponibilidad_confirmadas
      ON solicitudes_disponibilidad(negocio_id, respondida_en)
      WHERE decision = 'confirmada';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS solicitudes_disponibilidad;
    DROP TABLE IF EXISTS tokens_dispositivo;
    DROP TYPE IF EXISTS decision_disponibilidad;
  `);
};
