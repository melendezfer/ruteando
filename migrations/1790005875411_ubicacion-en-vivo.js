/**
 * Ubicación en vivo del vendedor ambulante (sin RF asociado, petición
 * directa del usuario — rehacer íconos/colores/modalidad, PR 2 de 3).
 *
 * `posiciones_en_vivo`: las posiciones que manda el propio vendedor
 * MIENTRAS tiene la app abierta (decisión explícita del usuario: sin
 * seguimiento en segundo plano, que un navegador/PWA no permite de todas
 * formas). No es un historial: cada inserción borra las posiciones de
 * más de 15 minutos (LIVE_LOCATION_TRAIL_MINUTES) de TODOS los negocios —
 * limpieza perezosa, sin cron, mismo criterio que el resto del proyecto
 * — y apagar el interruptor borra todas las del negocio en el acto. Lo
 * que queda guardado en cualquier momento es, como máximo, el rastro de
 * los últimos 15 minutos que el mapa muestra.
 *
 * `tipo_consentimiento` gana 'ubicacion_en_vivo' (Ley 1581: la posición en
 * vivo de una persona es un dato personal) — sin ese consentimiento el
 * servidor rechaza cualquier posición (403 consent-required).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE tipo_consentimiento ADD VALUE IF NOT EXISTS 'ubicacion_en_vivo';

    CREATE TABLE posiciones_en_vivo (
      id             BIGSERIAL PRIMARY KEY,
      negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      punto          GEOGRAPHY(Point, 4326) NOT NULL,
      registrada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_posiciones_en_vivo_negocio ON posiciones_en_vivo (negocio_id, registrada_en DESC);
    CREATE INDEX idx_posiciones_en_vivo_registrada ON posiciones_en_vivo (registrada_en);
    CREATE INDEX idx_posiciones_en_vivo_punto ON posiciones_en_vivo USING GIST (punto);
  `);
};

/**
 * Postgres no permite quitar un valor de un ENUM sin recrear el tipo (y
 * `consentimientos.tipo` lo usa): se borra la tabla y cualquier
 * consentimiento de este tipo, y se recrea el ENUM sin él.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS posiciones_en_vivo;
    DELETE FROM consentimientos WHERE tipo = 'ubicacion_en_vivo';
    ALTER TYPE tipo_consentimiento RENAME TO tipo_consentimiento_old;
    CREATE TYPE tipo_consentimiento AS ENUM ('tratamiento_datos', 'terminos_condiciones', 'registro_asistido', 'notificaciones');
    ALTER TABLE consentimientos ALTER COLUMN tipo TYPE tipo_consentimiento USING tipo::text::tipo_consentimiento;
    DROP TYPE tipo_consentimiento_old;
  `);
};
