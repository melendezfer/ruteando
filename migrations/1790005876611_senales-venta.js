/**
 * R5 — "Estoy vendiendo ahora" (docs/specs/r5-estoy-vendiendo.md). El
 * vendedor avisa por su cuenta que está vendiendo (o que ya no), sin
 * esperar a que un consumidor le pregunte.
 *
 * Tabla nueva en vez de reusar solicitudes_disponibilidad (spec DP-2): esa
 * tabla modela una PREGUNTA de un consumidor (usuario_id = quien pregunta,
 * expira_en de 10 min); un aviso propio no tiene pregunta detrás.
 *
 * Sin columna de vencimiento: igual que las respuestas, "fresco" se calcula
 * al leer comparando fecha_creacion contra el reloj (60 min, sin cron).
 * Manda la señal más reciente entre esta tabla y las respuestas a
 * preguntas (ver src/repositories/ultimaSenalVenta.js).
 *
 * `idx_solicitudes_disponibilidad_respondidas` cubre la otra mitad de esa
 * regla y reemplaza a idx_solicitudes_disponibilidad_confirmadas: el viejo
 * solo cubría decision = 'confirmada', y ahora también cuenta la última
 * respuesta 'rechazada' ("no" apaga el "vendiendo ahora"). Sin consultas
 * que lo usen, el viejo solo costaba escrituras.
 *
 * `confirmacion_venta` en tipo_evento (spec DP-7): lo registra el servidor
 * al guardar un aviso, nunca el cliente (EventInput.type no lo acepta).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE senal_venta AS ENUM ('vendiendo', 'dejo_de_vender');

    CREATE TABLE senales_venta (
      id             UUID PRIMARY KEY DEFAULT uuidv7(),
      negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      senal          senal_venta NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_senales_venta_negocio ON senales_venta(negocio_id, fecha_creacion DESC);

    CREATE INDEX idx_solicitudes_disponibilidad_respondidas
      ON solicitudes_disponibilidad(negocio_id, respondida_en DESC)
      WHERE decision IS NOT NULL;
    DROP INDEX IF EXISTS idx_solicitudes_disponibilidad_confirmadas;

    ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'confirmacion_venta';
  `);
};

/**
 * Postgres no permite quitar un valor de un ENUM: `confirmacion_venta`
 * queda en tipo_evento (inofensivo, nada lo escribe sin esta migración).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_solicitudes_disponibilidad_confirmadas
      ON solicitudes_disponibilidad(negocio_id, respondida_en)
      WHERE decision = 'confirmada';
    DROP INDEX IF EXISTS idx_solicitudes_disponibilidad_respondidas;
    DROP TABLE IF EXISTS senales_venta;
    DROP TYPE IF EXISTS senal_venta;
  `);
};
