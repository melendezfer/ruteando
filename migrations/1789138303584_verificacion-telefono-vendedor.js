/**
 * Verificación de teléfono de vendedores por SMS (OTP), antes de que un
 * negocio aparezca en el mapa/búsqueda pública — reduce vendedores
 * fantasma/cuentas falsas durante el piloto, reutilizando el mismo
 * número que ya se iba a publicar como contacto de WhatsApp (ver
 * CLAUDE.md, sección "Verificación de teléfono de vendedores" para la
 * justificación completa de por qué teléfono y no cédula/identidad
 * completa en esta etapa).
 *
 * negocios.telefono_verificado: default false — todo negocio existente
 * (solo datos sintéticos/de desarrollo en este punto del proyecto, sin
 * vendedores reales en producción todavía) queda sin verificar hasta que
 * pase por el flujo nuevo. No hay backfill a true: sería fingir una
 * verificación que nunca ocurrió.
 *
 * codigos_verificacion_telefono: a diferencia de codigos_recuperacion
 * (token opaco de 256 bits, colisión estadísticamente imposible), acá el
 * código es un OTP numérico corto (6 dígitos, legible desde un SMS) —
 * NO lleva UNIQUE en codigo_hash (un choque entre dos códigos de 6
 * dígitos, de negocios distintos o del mismo negocio en momentos
 * distintos, es perfectamente posible) y sí lleva `intentos`, que
 * codigos_recuperacion no necesita (con 10^6 combinaciones, sin un tope
 * de intentos fallidos el código es adivinable por fuerza bruta antes de
 * que expire). `telefono` guarda el número exacto al que se envió ese
 * código — si el vendedor cambia de número a mitad de un código
 * pendiente, confirmarCodigo igual solo puede marcar verificado el
 * negocio, no "este número en particular" (telefono_contacto ya es la
 * fuente de verdad de cuál es el número vigente); se guarda igual acá
 * como registro histórico de qué número se intentó verificar en cada
 * intento.
 *
 * usuarios.ip_origen: respaldo interno (nunca expuesto en la API ni al
 * propio usuario — ver user.mapper.js) por si alguna vez hace falta
 * colaborar con una autoridad ante un reporte de actividad ilegal. Sin
 * backfill: no hay forma de reconstruir la IP real de un registro ya
 * ocurrido.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE negocios ADD COLUMN telefono_verificado BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE codigos_verificacion_telefono (
      id            UUID PRIMARY KEY DEFAULT uuidv7(),
      negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
      telefono      VARCHAR(20) NOT NULL,
      codigo_hash   VARCHAR(255) NOT NULL,
      intentos      SMALLINT NOT NULL DEFAULT 0,
      creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
      expira_en     TIMESTAMPTZ NOT NULL,
      invalidado_en TIMESTAMPTZ
    );

    CREATE INDEX idx_codigos_verificacion_telefono_negocio ON codigos_verificacion_telefono(negocio_id);

    ALTER TABLE usuarios ADD COLUMN ip_origen INET;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios DROP COLUMN IF EXISTS ip_origen;
    DROP TABLE IF EXISTS codigos_verificacion_telefono;
    ALTER TABLE negocios DROP COLUMN IF EXISTS telefono_verificado;
  `);
};
