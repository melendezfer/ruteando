/**
 * Ofertas con vigencia sobre el catálogo existente (menú/promoción/combo/
 * evento), sin RF asociado — petición directa del usuario. Reusa
 * `productos` tal cual (misma tabla que ya representa un plato, un
 * producto o un servicio, ver CLAUDE.md sección 31) en vez de una tabla
 * aparte: una oferta con vigencia es, en la forma de los datos, un
 * producto más — nombre/descripción/precio/disponible ya alcanzan, lo
 * único que le falta es "de qué tipo de oferta es" y "hasta cuándo vale".
 *
 * `tipo_oferta_id` NULL + ambas vigencias NULL = producto de catálogo
 * normal (el caso de hoy, sin cambios de comportamiento para todo lo ya
 * sembrado). `ON DELETE SET NULL` (no RESTRICT): mismo criterio que
 * `productos.categoria_id` — si algún día un tipo de oferta se retira de
 * verdad (hoy el admin CRUD solo lo desactiva, ver migración
 * tipos-oferta), un producto que ya lo tenía no debería quedar
 * bloqueado de borrarse ni de por vida atado a un tipo que ya no existe.
 *
 * `vigencia_inicio` es la señal real de "esto es una oferta", no
 * `tipo_oferta_id` por sí solo — el formulario de oferta del frontend
 * siempre pide una vigencia (con atajos: "solo hoy", "este mes",
 * "personalizado"), así que en la práctica los dos viajan juntos; pero
 * la regla de negocio del plan gratis (ver FREE_PLAN_MAX_ACTIVE_OFFERS,
 * `productos.service.js#contarOfertasVigentes`) cuenta por
 * `vigencia_inicio IS NOT NULL`, no por `tipo_oferta_id IS NOT NULL` —
 * así un producto con vigencia pero sin tipo de oferta elegido (el campo
 * es opcional en ProductInput) sigue contando como "ocupa el cupo
 * gratis", que es lo que la regla de negocio real necesita proteger
 * (un vendedor gratis no puede tener más de una oferta activa a la vez,
 * sin importar si le puso etiqueta de tipo o no).
 *
 * `vigencia_fin > vigencia_inicio` no se valida acá con un CHECK (a
 * diferencia de `promociones.chk_promociones_fechas`) porque
 * `vigencia_fin` es opcional (una oferta puede no tener fecha de cierre,
 * "hasta nuevo aviso") — un CHECK que solo se aplica cuando la columna
 * no es NULL ya lo cubre `product.validators.js` en la capa de
 * aplicación (mismo criterio que el resto de este proyecto: casi ninguna
 * regla de negocio vive en un CHECK, salvo las pocas que ya estaban en
 * el schema original).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE productos
      ADD COLUMN tipo_oferta_id INTEGER REFERENCES tipos_oferta(id) ON DELETE SET NULL,
      ADD COLUMN vigencia_inicio TIMESTAMPTZ,
      ADD COLUMN vigencia_fin TIMESTAMPTZ;

    CREATE INDEX idx_productos_tipo_oferta ON productos(tipo_oferta_id) WHERE tipo_oferta_id IS NOT NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_productos_tipo_oferta;
    ALTER TABLE productos
      DROP COLUMN IF EXISTS tipo_oferta_id,
      DROP COLUMN IF EXISTS vigencia_inicio,
      DROP COLUMN IF EXISTS vigencia_fin;
  `);
};
