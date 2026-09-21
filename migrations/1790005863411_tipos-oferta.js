/**
 * Tabla de catálogo nueva, sin RF asociado (petición directa del usuario)
 * — qué "tipo de oferta" es un ítem del catálogo de un negocio: menú
 * (un plato/producto/servicio normal, sin vigencia), promoción, combo o
 * evento. Mismo patrón exacto que `categorias` (id entero pequeño,
 * `nombre`/`icono`/`orden_visualizacion`, administrada por el equipo del
 * proyecto — sin endpoint de creación pública, ver GET /categories) más
 * una columna `activo` que `categorias` no tiene: a diferencia de las
 * categorías (nunca se "retiran", solo se agregan más), un tipo de
 * oferta sí necesita poder dejar de ofrecerse para ítems nuevos sin
 * romper los productos que ya lo usan — por eso el admin CRUD (ver
 * `tiposOferta.service.js`) nunca borra una fila de verdad, solo apaga
 * `activo` (mismo criterio de "no hay DELETE real sobre un catálogo
 * compartido" que el resto del proyecto, ej. `resenas`/`fotos` con
 * `estado_moderacion` en vez de borrarse).
 *
 * 4 tipos sembrados acá, no solo en un script de demo — mismo motivo que
 * las categorías nuevas de comercio no gastronómico (ver
 * categorias-tipo-comercio-no-gastronomico): sin este INSERT, un
 * vendedor real en producción no tendría ningún tipo de oferta real
 * para elegir. `ON CONFLICT (nombre) DO NOTHING` la hace segura de
 * re-correr.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tipos_oferta (
      id                  SERIAL PRIMARY KEY,
      nombre              VARCHAR(80) NOT NULL UNIQUE,
      icono               VARCHAR(50),
      orden_visualizacion SMALLINT NOT NULL DEFAULT 0,
      activo              BOOLEAN NOT NULL DEFAULT true
    );

    INSERT INTO tipos_oferta (nombre, icono, orden_visualizacion) VALUES
      ('Menú', 'fork-knife', 0),
      ('Promoción', 'tag', 1),
      ('Combo', 'package', 2),
      ('Evento', 'calendar-star', 3)
    ON CONFLICT (nombre) DO NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS tipos_oferta;
  `);
};
