/**
 * Campo nuevo, sin RF asociado (petición directa del usuario, propia
 * rama `feature/movilidad-negocio`): el vendedor autodeclara si su
 * negocio es "ambulante" (se desplaza — carrito, moto, bicicleta) o de
 * "local fijo" (un punto de venta que no cambia) — mismo patrón que
 * `entrega_propia`/`higiene_autodeclarada`: una propiedad declarada
 * del negocio mismo, editable en cualquier momento desde su perfil sin
 * pasar por el formulario de ubicación.
 *
 * **Nombre elegido a propósito, no `tipo_ubicacion`**: `ubicaciones`
 * YA tiene una columna `tipo` sobre el ENUM `tipo_ubicacion` (fija |
 * movil | puesto | local | desde_casa | temporal, ver CLAUDE.md sección
 * 5/schema.sql) — reusar ese nombre para un ENUM/columna nuevo y
 * distinto en `negocios` habría chocado con un tipo de Postgres que ya
 * existe y habría sido confuso de leer (dos "tipo_ubicacion" con
 * significados relacionados pero no iguales). Se evaluó reusar
 * directamente `ubicaciones.tipo` (que ya distingue `movil` del resto)
 * en vez de agregar un campo nuevo, y se descartó: esa columna se
 * llena una sola vez en el registro (RF-005, `PUT
 * .../location`, un formulario más pesado que reenviar junto a
 * type/latitude/longitude) — lo que se pidió acá es un interruptor
 * independiente, editable en cualquier momento sin reabrir ese
 * formulario, mismo criterio que `entrega_propia`/`higiene_autodeclarada`.
 * `movilidad_negocio` (ENUM, 2 valores — cerrado, mismo criterio que
 * `tipo_categoria`/`dia_semana`) y la columna `negocios.movilidad`
 * quedan como conceptos deliberadamente separados de
 * `ubicaciones.tipo`, no un reemplazo.
 *
 * Default `'ambulante'`: coherente con el público objetivo original de
 * la plataforma (Documento 08, persona "Don Alirio" — vendedor
 * informal de comida callejera sin local fijo, CLAUDE.md sección 0/1)
 * — un negocio existente (solo datos sintéticos/de desarrollo a esta
 * altura) sin ninguna declaración explícita se asume más probablemente
 * ambulante que de local fijo.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE movilidad_negocio AS ENUM ('ambulante', 'local_fijo');

    ALTER TABLE negocios
      ADD COLUMN movilidad movilidad_negocio NOT NULL DEFAULT 'ambulante';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios DROP COLUMN IF EXISTS movilidad;
    DROP TYPE IF EXISTS movilidad_negocio;
  `);
};
