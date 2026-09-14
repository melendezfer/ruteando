/**
 * Campo nuevo, sin RF asociado (petición directa del usuario, ver
 * CLAUDE.md): higiene_autodeclarada indica si el vendedor declaró
 * voluntariamente que sigue un conjunto de buenas prácticas de higiene
 * (lavar y preparar en casa, mantener la comida tapada, manejo seguro
 * del cilindro de gas, etc.) — es una AUTOdeclaración del vendedor, nunca
 * una verificación de cumplimiento por parte de RUTEANDO ni una
 * certificación sanitaria oficial (ver el texto exacto de la insignia
 * pública en business.mapper.js y en el componente de frontend
 * correspondiente).
 *
 * Vive en `negocios`, mismo criterio que `entrega_propia`: es una
 * propiedad declarada del negocio mismo, sin relación con su ubicación
 * ni con la verificación de teléfono (que sí es una comprobación real
 * hecha por la plataforma, a diferencia de esto).
 *
 * Default false: un negocio existente (solo datos sintéticos/de
 * desarrollo a esta altura) no declaró nada al respecto, así que no hay
 * base para asumir que sí sigue esas prácticas.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios ADD COLUMN higiene_autodeclarada BOOLEAN NOT NULL DEFAULT false;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios DROP COLUMN IF EXISTS higiene_autodeclarada;
  `);
};
