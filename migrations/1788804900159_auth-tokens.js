/**
 * Épica 1 (Autenticación) — dos tablas que no estaban en las 12 originales
 * de schema.sql (Documento 07), porque son infraestructura de auth, no
 * parte del modelo de dominio:
 *
 * - tokens_refresco: guarda el hash del refresh token vigente para poder
 *   implementar renovación rotativa de un solo uso (RFC 9700). reemplazado_por
 *   encadena cada rotación con la siguiente, para poder revocar toda la
 *   familia si se detecta reuso de un token ya rotado (señal de robo).
 * - codigos_recuperacion: soporta RF-003 (recuperación de contraseña).
 *   invalidado_en cubre dos casos con el mismo efecto (ya no sirve): que se
 *   haya usado, o que se haya pedido un código más nuevo para la misma
 *   cuenta.
 *
 * Ninguna de las dos guarda el valor crudo del token/código, solo su hash
 * SHA-256 — misma regla que contrasena_hash en usuarios.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tokens_refresco (
      id              UUID PRIMARY KEY DEFAULT uuidv7(),
      usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash      VARCHAR(255) NOT NULL UNIQUE,
      creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
      expira_en       TIMESTAMPTZ NOT NULL,
      revocado_en     TIMESTAMPTZ,
      reemplazado_por UUID REFERENCES tokens_refresco(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_tokens_refresco_usuario ON tokens_refresco(usuario_id);

    CREATE TABLE codigos_recuperacion (
      id              UUID PRIMARY KEY DEFAULT uuidv7(),
      usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      codigo_hash     VARCHAR(255) NOT NULL UNIQUE,
      creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
      expira_en       TIMESTAMPTZ NOT NULL,
      invalidado_en   TIMESTAMPTZ
    );

    CREATE INDEX idx_codigos_recuperacion_usuario ON codigos_recuperacion(usuario_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS codigos_recuperacion;
    DROP TABLE IF EXISTS tokens_refresco;
  `);
};
