/**
 * Franjas del día con ubicación propia para el vendedor ambulante (sin RF
 * asociado, petición directa del usuario — rehacer íconos/colores/
 * modalidad, PR 1 de 3). Ej.: un vendedor de tinto en los paraderos de
 * bus de 5-9am, a la salida del colegio de 12-2pm, y otra vez en los
 * paraderos de 5-8pm.
 *
 * Mismo patrón que `tipos_oferta.requiere_horario_negocio`: nada se
 * "activa" ni "desactiva" con un cron — una franja cuenta como vigente
 * solo si el reloj (hora de Bogotá) cae dentro de ella en el momento de
 * la consulta, con la misma regla de turno nocturno cruzando medianoche
 * que ya usa `horarios` (fila de HOY + fila de AYER, ver
 * negocios.repository.js#condicionRangoHorarioSQL). Fuera de toda
 * franja, el negocio vuelve a mostrarse en su ubicación base
 * (`ubicaciones.es_actual`) — nunca se oculta (decisión B, CLAUDE.md
 * sección 37).
 *
 * Solo aplica a `negocios.movilidad = 'ambulante'` (lo exige el servicio
 * al guardar y la consulta al leer: si el negocio cambia de modalidad,
 * sus franjas quedan guardadas pero dejan de tener efecto).
 *
 * `hora_fin < hora_inicio` = franja nocturna (igual que horarios);
 * igualdad rechazada por CHECK (ambigua, mismo criterio que horarios).
 * Índice GIST sobre `punto`: /businesses/nearby busca candidatos también
 * por la ubicación de la franja, no solo por la base.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE franjas_ubicacion (
      id                   BIGSERIAL PRIMARY KEY,
      negocio_id           UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      dia                  dia_semana NOT NULL,
      hora_inicio          TIME NOT NULL,
      hora_fin             TIME NOT NULL,
      punto                GEOGRAPHY(Point, 4326) NOT NULL,
      direccion_referencia VARCHAR(255),
      fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_franjas_rango CHECK (hora_inicio <> hora_fin)
    );

    CREATE INDEX idx_franjas_ubicacion_negocio ON franjas_ubicacion (negocio_id, dia);
    CREATE INDEX idx_franjas_ubicacion_punto ON franjas_ubicacion USING GIST (punto);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS franjas_ubicacion;`);
};
