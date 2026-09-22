/**
 * Fase 1 de 5 del panel de administrador (sin RF asociado, petición
 * directa del usuario) — la base: dos roles, login separado, un punto
 * central de permisos, y auditoría desde ya. Las fases 2-5 (colas de
 * decisión, catálogos, directorios, estadísticas, identidad) se agregan
 * después como módulos nuevos sobre esta misma base, sin reestructurar
 * nada de lo que sigue.
 *
 * `administradores` es una tabla NUEVA, separada de `usuarios` — a
 * propósito, pedido explícito del usuario ("login de administrador
 * separado del login de vendedor/consumidor... no mismo flujo de
 * usuarios normales"). La Épica 9 (CLAUDE.md sección 6) ya usaba
 * `usuarios.rol = 'administrador'` para un conjunto de rutas /admin/*
 * (aprobar negocios, moderar reseñas, etc.) — esa tabla y esas rutas NO
 * se tocan ni se migran acá: siguen funcionando exactamente igual,
 * independientes de este sistema nuevo. Ver CLAUDE.md (sección de este
 * panel) para el detalle completo de por qué conviven dos conceptos de
 * "administrador" a propósito, no por descuido.
 *
 * `rol_administrador` (dos valores, no un booleano `es_admin`, pedido
 * explícito): 'administrador' (delegable, lo puede crear un
 * `administrador_maestro`) y 'administrador_maestro' (dueño). Un ENUM
 * de dos valores en vez de un booleano dice explícitamente en el schema
 * qué dos cosas son posibles, y ya deja lugar para agregar un tercer
 * rol en el futuro (ej. "administrador de solo lectura") con una sola
 * migración de ALTER TYPE, no una reescritura de columna.
 *
 * `tokens_refresco_administrador` — mismo patrón exacto que
 * `tokens_refresco` (migración auth-tokens): renovación rotativa de un
 * solo uso (RFC 9700), `reemplazado_por` encadena cada rotación,
 * `revocado_en` cierra una sesión. Tabla separada (no una columna
 * `es_admin` en `tokens_refresco`) porque referencia a una tabla
 * distinta (`administradores`, no `usuarios`) — un FK no puede apuntar
 * condicionalmente a una u otra.
 *
 * `auditoria_admin` — registra QUIÉN (administrador_id) hizo QUÉ
 * (accion) sobre QUÉ (entidad_tipo + entidad_id) y CUÁNDO (fecha).
 * `accion`/`entidad_tipo` son texto libre, no un ENUM: las fases 2-5
 * van a inventar acciones/entidades nuevas de forma incremental
 * (aprobar negocio, suspender usuario, moderar oferta...) y un ENUM
 * exigiría una migración por cada una — mismo criterio ya usado en el
 * proyecto para texto abierto por diseño (ej. `reportes_negocio.motivo`).
 * `entidad_id` es TEXT, no UUID, porque las entidades futuras tienen
 * distintos tipos de id (UUID para negocios/usuarios, INTEGER para
 * tipos_oferta) — un solo campo polimórfico sin FK (no puede haber un
 * FK real hacia "la tabla que sea según entidad_tipo"). `detalle`
 * (JSONB, nullable) deja espacio para contexto extra (valores viejo/
 * nuevo, motivo) sin necesitar una columna nueva por cada acción futura.
 * `administrador_id` con ON DELETE SET NULL (no CASCADE, mismo criterio
 * que `solicitudes_eliminacion_cuenta.usuario_id`): si algún día se
 * borra la cuenta de un administrador, el registro de auditoría debe
 * sobrevivir — es evidencia de qué se hizo, no un dato personal a
 * eliminar junto con la cuenta.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE rol_administrador AS ENUM ('administrador', 'administrador_maestro');

    CREATE TABLE administradores (
      id                  UUID PRIMARY KEY DEFAULT uuidv7(),
      nombre_completo     VARCHAR(150) NOT NULL,
      correo              VARCHAR(255) NOT NULL UNIQUE,
      contrasena_hash     VARCHAR(255) NOT NULL,
      rol                 rol_administrador NOT NULL DEFAULT 'administrador',
      fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
      activo              BOOLEAN NOT NULL DEFAULT true
    );

    CREATE INDEX idx_administradores_rol ON administradores(rol);

    CREATE TABLE tokens_refresco_administrador (
      id              UUID PRIMARY KEY DEFAULT uuidv7(),
      administrador_id UUID NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
      token_hash      VARCHAR(255) NOT NULL UNIQUE,
      creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
      expira_en       TIMESTAMPTZ NOT NULL,
      revocado_en     TIMESTAMPTZ,
      reemplazado_por UUID REFERENCES tokens_refresco_administrador(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_tokens_refresco_admin_administrador ON tokens_refresco_administrador(administrador_id);

    CREATE TABLE auditoria_admin (
      id               BIGSERIAL PRIMARY KEY,
      administrador_id UUID REFERENCES administradores(id) ON DELETE SET NULL,
      accion           VARCHAR(100) NOT NULL,
      entidad_tipo     VARCHAR(50),
      entidad_id       VARCHAR(100),
      detalle          JSONB,
      fecha            TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_auditoria_admin_administrador ON auditoria_admin(administrador_id);
    CREATE INDEX idx_auditoria_admin_entidad ON auditoria_admin(entidad_tipo, entidad_id);
    CREATE INDEX idx_auditoria_admin_fecha ON auditoria_admin(fecha DESC);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS auditoria_admin;
    DROP TABLE IF EXISTS tokens_refresco_administrador;
    DROP TABLE IF EXISTS administradores;
    DROP TYPE IF EXISTS rol_administrador;
  `);
};
