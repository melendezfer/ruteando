/**
 * Plan gratis vs. pago, sin RF asociado — petición directa del usuario,
 * como parte de la funcionalidad de ofertas con vigencia (ver CLAUDE.md,
 * migración productos-tipo-oferta): el plan gratis limita a 1 producto
 * con vigencia activa por negocio a la vez; el plan pago no tiene ese
 * límite (ver `productos.service.js#validarLimiteOfertaGratis`).
 *
 * Deliberadamente NO es la tabla `planes_negocio` (con `origen`,
 * `fecha_inicio`/`fecha_fin`, referencia de pago) que la sección 11 de
 * CLAUDE.md ya deja documentada como diseño futuro para el cobro real
 * por visibilidad — esta tanda excluye explícitamente la pasarela de
 * pago real (ver la conversación de planeación). Un enum simple en
 * `negocios` es lo mínimo que la regla de negocio de hoy necesita para
 * existir; cuando haya una pasarela real, migrar a la tabla completa
 * (con historial de pagos/vencimientos) es un cambio de diseño aparte,
 * no una extensión de esta columna.
 *
 * Sin ningún endpoint que lo cambie todavía (ni en BusinessInput ni en
 * un endpoint propio) — a propósito: sin pasarela de pago real, no hay
 * ninguna forma legítima de que un vendedor se autoasigne el plan pago
 * (sería un campo que cualquiera podría activarse gratis). Por ahora
 * solo se cambia a mano por SQL (mismo criterio que aprobar un negocio
 * de prueba en desarrollo, ver CLAUDE.md sección 34) hasta que exista
 * un flujo de cobro real o, al menos, un endpoint administrativo para
 * asignarlo manualmente — ninguno de los dos se pidió en esta tanda.
 *
 * Default 'gratis': ningún negocio existente (solo datos sintéticos/de
 * desarrollo a esta altura del proyecto) debería empezar con el límite
 * ya levantado sin haber pagado nada.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE plan_negocio AS ENUM ('gratis', 'pago');

    ALTER TABLE negocios
      ADD COLUMN plan plan_negocio NOT NULL DEFAULT 'gratis';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios DROP COLUMN IF EXISTS plan;
    DROP TYPE IF EXISTS plan_negocio;
  `);
};
