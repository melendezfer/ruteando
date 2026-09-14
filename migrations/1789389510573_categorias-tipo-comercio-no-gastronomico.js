/**
 * Expansión de alcance (petición directa del usuario, sin RF asociado —
 * ver CLAUDE.md sección 31): RUTEANDO deja de ser exclusivamente un
 * directorio de comida callejera y pasa a admitir comercio informal no
 * gastronómico (costura/sastrería, servicios legales básicos,
 * artesanías, y lo que se agregue después). El modelo de datos de
 * `negocios`/`productos` ya era genérico (nombre/descripción/precio/
 * disponible/foto — nada específico de comida); lo único que faltaba era
 * una forma de que `categorias` supiera distinguir el "tipo" de comercio
 * que agrupa, para que el frontend pueda adaptar la sección de
 * contenido del perfil ("Menú" vs "Productos" vs "Servicios", ver
 * client/src/lib/catalog/catalog-label.ts) sin forzar el mismo rótulo a
 * todos los negocios.
 *
 * `tipo_categoria` (3 valores, cerrado — mismo criterio que
 * `tipo_ubicacion`/`dia_semana`, un ENUM cuando el catálogo es fijo):
 *   - 'alimentos': comida (el negocio original del proyecto) — su
 *     catálogo se sigue llamando "Menú".
 *   - 'productos': bienes físicos que no son comida (ej. artesanías) —
 *     catálogo "Productos", misma estructura de fila que un plato
 *     (nombre/descripción/precio/disponible/foto) pero mostrado con un
 *     rótulo distinto.
 *   - 'servicios': servicios (ej. costura/sastrería, asesoría legal
 *     básica) — catálogo "Servicios"; reusa la misma tabla `productos`
 *     (una fila = un servicio con su precio), no se creó una tabla
 *     aparte porque la forma de los datos es idéntica, solo cambia cómo
 *     se presenta.
 *
 * Default `'alimentos'` en la columna nueva: **ninguna categoría
 * existente cambia de comportamiento** — todo negocio de comida
 * sembrado hasta ahora sigue mostrando "Menú" exactamente igual que
 * antes de esta migración.
 *
 * Las 3 categorías nuevas se insertan acá (no solo en el script de demo)
 * porque `categorias` no tiene endpoint de creación (administrada solo
 * por el equipo del proyecto, ver el comentario original en schema.sql)
 * — sin este INSERT, un vendedor de un rubro no gastronómico no tendría
 * ninguna categoría real para elegir en producción/staging, solo en la
 * base de datos de quien corrió el script de demo a mano.
 * `ON CONFLICT (nombre) DO NOTHING` la hace segura de re-correr.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE tipo_categoria AS ENUM ('alimentos', 'productos', 'servicios');

    ALTER TABLE categorias
      ADD COLUMN tipo tipo_categoria NOT NULL DEFAULT 'alimentos';

    INSERT INTO categorias (nombre, tipo, orden_visualizacion) VALUES
      ('Costura y sastrería', 'servicios', 100),
      ('Servicios legales básicos', 'servicios', 101),
      ('Artesanías', 'productos', 102)
    ON CONFLICT (nombre) DO NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM categorias
      WHERE nombre IN ('Costura y sastrería', 'Servicios legales básicos', 'Artesanías');

    ALTER TABLE categorias DROP COLUMN tipo;
    DROP TYPE tipo_categoria;
  `);
};
