/**
 * Calificaciones públicas al instante (regla del usuario, 2026-10-03;
 * docs/specs/perfil-2.md §3.6). Verificado con la app: toda calificación
 * nacía 'pendiente', el promedio público solo cuenta 'aprobada' y no hay
 * panel de administrador para aprobarlas, así que ninguna se publicaba
 * ("Todavía sin reseñas" para siempre).
 *
 * Desde ahora una calificación nace 'aprobada' (resenas.repository.js) y la
 * moderación queda solo para lo REPORTADO. Las que esperaban sin ningún
 * reporte se publican; las reportadas siguen en la cola.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE resenas ALTER COLUMN estado_moderacion SET DEFAULT 'aprobada';
    UPDATE resenas r SET estado_moderacion = 'aprobada'
     WHERE r.estado_moderacion = 'pendiente'
       AND NOT EXISTS (SELECT 1 FROM reportes_resena rr WHERE rr.resena_id = r.id);
  `);
};

/** El default vuelve; las calificaciones ya publicadas no se despublican. */
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE resenas ALTER COLUMN estado_moderacion SET DEFAULT 'pendiente';`);
};
