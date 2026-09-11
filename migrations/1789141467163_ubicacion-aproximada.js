/**
 * "Mostrar mi dirección exacta" vs. "Mostrar solo la zona aproximada"
 * (petición del usuario, sin RF asociado en los Documentos 05-15):
 * protege a un vendedor que opera desde su casa (ej. desayunos sorpresa
 * a domicilio, tipo_ubicacion 'desde_casa') de exponer su dirección
 * exacta en el mapa público solo por registrarse en la plataforma.
 *
 * Default false ("zona aproximada") a propósito — pedido explícito del
 * usuario: la opción más protectora es la que rige sin que el vendedor
 * tenga que saber que existe o acordarse de activarla.
 *
 * Vive en `ubicaciones`, no en `negocios`: es una propiedad de "cómo se
 * expone este punto geográfico", el mismo dominio que `tipo` y
 * `direccion_referencia` en esa misma tabla — no de la identidad del
 * negocio en sí. La dirección/coordenada exacta sigue viviendo en
 * `punto` sin cambios; esta columna solo decide si
 * negocios.repository.js#listar/cercanos y business.mapper.js#toApiLocation
 * devuelven esa coordenada tal cual o aproximada (ver CLAUDE.md).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE ubicaciones ADD COLUMN mostrar_ubicacion_exacta BOOLEAN NOT NULL DEFAULT false;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE ubicaciones DROP COLUMN IF EXISTS mostrar_ubicacion_exacta;
  `);
};
