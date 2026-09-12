/**
 * Rediseño de reseñas (petición directa del usuario, sin RF asociado — ver
 * CLAUDE.md): separa la señal pública (promedio de estrellas + conteo,
 * sin cambios, ver business.mapper.js#toApiBusinessProfile) de la
 * retroalimentación privada que solo ve el dueño del negocio (y el equipo
 * administrador, para moderar abuso).
 *
 * `comentario` (hasta ahora público, mostrado en GET /businesses/{id}/reviews)
 * se renombra a `comentario_privado` — no se pierde el dato, solo cambia
 * quién puede verlo (ver resenas.service.js, ruta pública eliminada).
 *
 * `etiquetas`: catálogo corto y fijo de etiquetas rápidas (RN, no un RF
 * documentado) — un array de un enum nuevo, no una tabla de relación
 * aparte, porque el catálogo es fijo y pequeño (8 valores) y una reseña
 * puede llevar varias a la vez; mismo criterio de "enum cuando el
 * catálogo es cerrado" que ya usa el resto del esquema (tipo_ubicacion,
 * dia_semana, etc.), solo que en array porque acá sí puede haber más de
 * un valor por fila.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE etiqueta_resena AS ENUM (
      'comida_caliente',
      'comida_fria',
      'buen_trato',
      'espera_larga',
      'buen_precio',
      'precio_alto',
      'buena_presentacion',
      'poca_cantidad'
    );

    ALTER TABLE resenas RENAME COLUMN comentario TO comentario_privado;

    ALTER TABLE resenas
      ADD COLUMN etiquetas etiqueta_resena[] NOT NULL DEFAULT '{}';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE resenas DROP COLUMN etiquetas;
    ALTER TABLE resenas RENAME COLUMN comentario_privado TO comentario;
    DROP TYPE etiqueta_resena;
  `);
};
