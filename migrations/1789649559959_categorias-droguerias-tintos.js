/**
 * Búsqueda por familia (Fase 5 de la fusión de buscadores, petición
 * directa del usuario, sin RF asociado — ver CLAUDE.md sección 45): el
 * usuario pidió poder buscar "droguerías" y "tintos" como si fueran
 * categorías, pero ninguna de las dos existía todavía — ni siquiera
 * "comida rápida" cubría eso (esa ya existe, ver categoria "Comida
 * rápida" sembrada por scripts/seedDemoBusinesses.js). Sin categorías
 * reales, no hay nada que un vendedor de esos rubros pueda elegir para
 * aparecer ahí — mismo criterio que la migración
 * categorias-tipo-comercio-no-gastronomico (las categorías nuevas se
 * insertan acá, no solo en el script de demo, porque `categorias` no
 * tiene endpoint de creación).
 *
 * 'Droguerías' → tipo 'productos' (vende bienes físicos, no presta un
 * servicio ni prepara comida). 'Tintos y café' → tipo 'alimentos' (es
 * comida/bebida, aunque el negocio sea un puesto pequeño, no un
 * restaurante). `ON CONFLICT (nombre) DO NOTHING` la hace segura de
 * re-correr.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO categorias (nombre, tipo, orden_visualizacion) VALUES
      ('Droguerías', 'productos', 103),
      ('Tintos y café', 'alimentos', 104)
    ON CONFLICT (nombre) DO NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM categorias WHERE nombre IN ('Droguerías', 'Tintos y café');
  `);
};
