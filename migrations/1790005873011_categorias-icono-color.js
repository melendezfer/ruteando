/**
 * Ícono y color PROPIOS por categoría (sin RF asociado, petición directa
 * del usuario — rehacer íconos/colores/modalidad, PR 1 de 3).
 *
 * Antes: `categorias.icono` existía desde schema.sql pero estaba vacía y
 * nadie la leía — el frontend deducía un ícono por `tipo` (olla/paquete/
 * maletín: 9 categorías de comida con el mismo ícono) y el color del pin
 * salía de un hash del `id` (inestable entre ambientes, porque los ids
 * cambian entre desarrollo/CI/producción, y con colisiones: 6 de 9
 * categorías de comida caían en el mismo tono). Ahora ambos son datos
 * guardados.
 *
 * `icono`: nombre kebab-case de Phosphor (mismo formato que
 * `tipos_oferta.icono`, ej. 'fork-knife') — el frontend lo traduce con un
 * único mapa (client/src/lib/icons/category-icons.ts).
 *
 * `color`: hex fijo. Deliberadamente UN tono por familia de tipo
 * (alimentos naranja, servicios turquesa, productos morado), no un tono
 * distinto por categoría: con 14 categorías no existen 14 colores que se
 * distingan entre sí (ni con visión normal) y que además no choquen con
 * los colores de estado ya reservados (verde "abierto", violeta de marca/
 * grupos de pines, mostaza de zonas, rojo de error, azul del punto "mi
 * ubicación"). La identidad de la categoría la carga el ÍCONO; el color
 * dice la familia. Validado con scripts/validate_palette.js (skill
 * dataviz) en claro y oscuro: los 3 tonos entre sí y cada uno contra los
 * colores de estado pasan el piso de visión normal (ΔE ≥ 15). La columna
 * es por categoría igual, para poder separar un tono propio más adelante
 * sin otra migración.
 *
 * Este INSERT ... ON CONFLICT también crea las categorías que hasta ahora
 * solo existían por scripts/seedDemoBusinesses.js (Arepas, Empanadas,
 * Fruver, etc.) — sin esto, un ambiente nuevo (staging/producción) solo
 * tendría las 5 que sí venían por migración, sin ninguna categoría de
 * comida para elegir. 'Postres' (creada a mano en desarrollo, duplica
 * 'Dulces y postres') NO se crea acá: solo se le asigna ícono/color si ya
 * existe.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE categorias
      ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#6b7280'
        CONSTRAINT chk_categorias_color CHECK (color ~ '^#[0-9a-f]{6}$');

    INSERT INTO categorias (nombre, tipo, icono, color, orden_visualizacion) VALUES
      ('Arepas',                         'alimentos', 'bread',              '#e8590c', 1),
      ('Comida rápida',                  'alimentos', 'hamburger',          '#e8590c', 2),
      ('Perros calientes y salchipapas', 'alimentos', 'flame',              '#e8590c', 3),
      ('Empanadas',                      'alimentos', 'cooking-pot',        '#e8590c', 4),
      ('Dulces y postres',               'alimentos', 'cake',               '#e8590c', 5),
      ('Jugos naturales',                'alimentos', 'orange-slice',       '#e8590c', 6),
      ('Fruver',                         'alimentos', 'carrot',             '#e8590c', 7),
      ('Tintos y café',                  'alimentos', 'coffee',             '#e8590c', 104),
      ('Costura y sastrería',            'servicios', 'scissors',           '#1098ad', 100),
      ('Servicios legales básicos',      'servicios', 'scales',             '#1098ad', 101),
      ('Clases particulares',            'servicios', 'chalkboard-teacher', '#1098ad', 105),
      ('Artesanías',                     'productos', 'yarn',               '#9c36b5', 102),
      ('Droguerías',                     'productos', 'pill',               '#9c36b5', 103)
    ON CONFLICT (nombre) DO UPDATE
      SET tipo = EXCLUDED.tipo, icono = EXCLUDED.icono, color = EXCLUDED.color;

    UPDATE categorias SET icono = 'ice-cream', color = '#e8590c', tipo = 'alimentos'
     WHERE nombre = 'Postres';

    -- Una sola cosa por ícono en toda la app: 'tag' queda como "oferta con
    -- vigencia" genérica (insignia de oferta, pestaña "Cerca de ti
    -- ahora", tipo desconocido); Promoción pasa a su propio ícono.
    UPDATE tipos_oferta SET icono = 'percent' WHERE nombre = 'Promoción' AND icono = 'tag';
  `);
};

/**
 * No borra las categorías creadas por el INSERT (pueden tener negocios
 * asociados, FK RESTRICT) — solo quita la columna nueva y vacía los
 * íconos, volviendo al estado anterior de la columna `icono`.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    UPDATE tipos_oferta SET icono = 'tag' WHERE nombre = 'Promoción' AND icono = 'percent';
    UPDATE categorias SET icono = NULL;
    ALTER TABLE categorias DROP COLUMN IF EXISTS color;
  `);
};
