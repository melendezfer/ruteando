/**
 * Corrige un gap ya documentado (ver CLAUDE.md sección 31, "Gaps
 * conocidos" de la expansión a comercio no gastronómico): el catálogo de
 * etiquetas rápidas de reseñas (sección 26) nació pensado solo para
 * comida (`comida_caliente`, `poca_cantidad`...) — le quedaban raras a
 * la retroalimentación privada de una costurera o un abogado. Se agregan
 * 7 valores nuevos al enum `etiqueta_resena`, para que el frontend
 * (client/src/lib/reviews/review-tags.ts) pueda mostrar un catálogo
 * distinto según `categorias.tipo` (alimentos/productos/servicios, ver
 * sección 31) en vez de forzar siempre las etiquetas de comida.
 *
 * 4 de las 8 etiquetas originales (`buen_trato`, `espera_larga`,
 * `buen_precio`, `precio_alto`) ya eran genéricas — se siguen mostrando
 * para cualquier tipo de negocio, no se duplican acá. Las otras 4
 * (`comida_caliente`, `comida_fria`, `buena_presentacion`,
 * `poca_cantidad`) quedan exclusivas de `alimentos`.
 *
 * Nuevas, para `productos` (bienes físicos no gastronómicos, ej.
 * artesanías): `buena_calidad`, `mala_calidad`, `no_como_se_esperaba`
 * (`buena_presentacion`, ya existente, se reusa acá también — aplica
 * igual de bien al empaque/acabado de un producto que a un plato).
 *
 * Nuevas, para `servicios` (ej. costura/sastrería, asesoría legal
 * básica): `buen_asesoramiento`, `no_resolvio_problema`, `puntual`,
 * `impuntual`.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE etiqueta_resena ADD VALUE 'buena_calidad';
    ALTER TYPE etiqueta_resena ADD VALUE 'mala_calidad';
    ALTER TYPE etiqueta_resena ADD VALUE 'no_como_se_esperaba';
    ALTER TYPE etiqueta_resena ADD VALUE 'buen_asesoramiento';
    ALTER TYPE etiqueta_resena ADD VALUE 'no_resolvio_problema';
    ALTER TYPE etiqueta_resena ADD VALUE 'puntual';
    ALTER TYPE etiqueta_resena ADD VALUE 'impuntual';
  `);
};

/**
 * ALTER TYPE ... ADD VALUE no se puede revertir dentro de una migración
 * (Postgres no soporta DROP VALUE en un enum) — mismo criterio ya
 * documentado en la migración estado-negocio-rechazado.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = () => {
  throw new Error(
    'No reversible: Postgres no soporta remover un valor de un enum (ALTER TYPE ... DROP VALUE).',
  );
};
