/**
 * Campo nuevo, sin RF asociado (petición directa del usuario, ver
 * CLAUDE.md): entrega_propia indica si el vendedor mismo hace entregas a
 * domicilio de su producto — la plataforma no intermedia esa logística
 * ni ese pago (sección 0/15 de CLAUDE.md, "sin pagos dentro de la
 * aplicación"), es solo información que el vendedor declara para que el
 * consumidor la vea en el perfil público.
 *
 * Vive en `negocios`, no en `ubicaciones`: a diferencia de
 * mostrar_ubicacion_exacta (una propiedad de "cómo se expone este punto
 * geográfico"), esto es una propiedad del negocio mismo, sin relación con
 * su ubicación — un negocio con ubicación fija o móvil puede o no ofrecer
 * domicilios propios, independientemente del tipo_ubicacion.
 *
 * Default false: un negocio existente (solo datos sintéticos/de
 * desarrollo a esta altura) no declaró nada al respecto, así que no hay
 * base para asumir que sí ofrece domicilios propios.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios ADD COLUMN entrega_propia BOOLEAN NOT NULL DEFAULT false;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios DROP COLUMN IF EXISTS entrega_propia;
  `);
};
