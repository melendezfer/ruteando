/**
 * Sin RF asociado — petición directa del usuario (tarea aparte, planeada
 * junto con el badge de disponibilidad de producto y el campo de
 * bancas/asientos, ver CLAUDE.md): un tipo de oferta (menú/promoción/
 * combo/evento, ver migración tipos-oferta) puede necesitar o no que el
 * negocio esté dentro de su horario declarado para que la oferta cuente
 * como vigente — un menú de almuerzo (12m-3pm) no debería aparecer en
 * "cerca de ti" a las 9am aunque su `vigenciaFin` sea esta misma noche;
 * un evento (concierto, feria) sí puede ser válido fuera del horario
 * normal del negocio, porque no está atado a cuándo el negocio abre para
 * vender su catálogo normal.
 *
 * `requiere_horario_negocio BOOLEAN NOT NULL DEFAULT true` — los 3 tipos
 * ya sembrados que representan el catálogo normal del negocio (menú,
 * promoción, combo) conservan el comportamiento implícito que ya tenían
 * (nunca se cruzaba contra el horario, pero tampoco había forma de que
 * una oferta de ese tipo tuviera sentido fuera de horario) sin tocar
 * ningún dato; solo 'Evento' se marca explícitamente `false`, la única
 * excepción real.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE tipos_oferta
      ADD COLUMN requiere_horario_negocio BOOLEAN NOT NULL DEFAULT true;

    UPDATE tipos_oferta SET requiere_horario_negocio = false WHERE nombre = 'Evento';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tipos_oferta DROP COLUMN IF EXISTS requiere_horario_negocio;
  `);
};
