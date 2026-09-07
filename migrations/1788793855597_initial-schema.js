const fs = require('node:fs');
const path = require('node:path');

/**
 * Envuelve schema.sql (Documento 07, ya verificado contra Postgres+PostGIS
 * real) como primera migración versionada, tal como pide CLAUDE.md sección
 * 6 — no reinventar el esquema, solo darle seguimiento de versión.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  pgm.sql(schemaSql);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS
      eventos, consentimientos, promociones, favoritos, resenas,
      horarios, fotos, productos, ubicaciones, negocios, categorias, usuarios
    CASCADE;

    DROP TYPE IF EXISTS
      tipo_consentimiento, tipo_evento, dia_semana, estado_moderacion,
      tipo_foto, tipo_ubicacion, estado_negocio, rol_usuario;
  `);
};
