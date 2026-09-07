-- RUTEANDO — esquema de base de datos (Documento 07, Diseño de Datos)
-- PostgreSQL 18 + PostGIS 3.6. Pensado como primera migración del proyecto.
-- Orden de creación: extensión, tipos enumerados, y luego las tablas en
-- orden de dependencia (una tabla nunca referencia a otra que aún no existe).

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Tipos enumerados
-- ============================================================

CREATE TYPE rol_usuario AS ENUM (
  'consumidor', 'vendedor', 'administrador'
);

CREATE TYPE estado_negocio AS ENUM (
  'pendiente', 'activo', 'suspendido', 'cerrado'
);

CREATE TYPE tipo_ubicacion AS ENUM (
  'fija', 'movil', 'puesto', 'local', 'desde_casa', 'temporal'
);

CREATE TYPE tipo_foto AS ENUM (
  'negocio', 'producto'
);

CREATE TYPE estado_moderacion AS ENUM (
  'pendiente', 'aprobada', 'rechazada'
);

CREATE TYPE dia_semana AS ENUM (
  'lunes', 'martes', 'miercoles', 'jueves',
  'viernes', 'sabado', 'domingo'
);

CREATE TYPE tipo_evento AS ENUM (
  'busqueda', 'vista_negocio', 'vista_producto',
  'clic_contacto', 'favorito_agregado',
  'resena_creada', 'registro_negocio'
);

CREATE TYPE tipo_consentimiento AS ENUM (
  'tratamiento_datos', 'terminos_condiciones',
  'registro_asistido', 'notificaciones'
);

-- ============================================================
-- 1. usuarios
-- ============================================================
-- La contraseña nunca se guarda en texto plano: contrasena_hash almacena
-- el resultado de una función de hash con sal (bcrypt/argon2), nunca la
-- contraseña original (RNF-002, Documento 05).

CREATE TABLE usuarios (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  nombre_completo     VARCHAR(150) NOT NULL,
  correo              VARCHAR(255) NOT NULL UNIQUE,
  telefono            VARCHAR(20),
  contrasena_hash     VARCHAR(255) NOT NULL,
  rol                 rol_usuario NOT NULL DEFAULT 'consumidor',
  foto_perfil_url     VARCHAR(500),
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  activo              BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- ============================================================
-- 2. categorias
-- ============================================================
-- Única tabla de catálogo con identificador entero (SMALLSERIAL) en vez de
-- UUID: es pequeña, estable y administrada solo por el equipo del
-- proyecto, no por usuarios finales.

CREATE TABLE categorias (
  id                  SMALLSERIAL PRIMARY KEY,
  nombre              VARCHAR(80) NOT NULL UNIQUE,
  icono               VARCHAR(50),
  orden_visualizacion SMALLINT NOT NULL DEFAULT 0
);

-- ============================================================
-- 3. negocios
-- ============================================================
-- ON DELETE RESTRICT en ambas llaves foráneas evita borrar por accidente
-- un usuario o una categoría que todavía tiene negocios asociados.

CREATE TABLE negocios (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  usuario_id          UUID NOT NULL REFERENCES usuarios(id)
                        ON DELETE RESTRICT,
  categoria_id        SMALLINT NOT NULL REFERENCES categorias(id)
                        ON DELETE RESTRICT,
  nombre              VARCHAR(150) NOT NULL,
  descripcion         TEXT,
  estado              estado_negocio NOT NULL DEFAULT 'pendiente',
  telefono_contacto   VARCHAR(20),
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_negocios_usuario   ON negocios(usuario_id);
CREATE INDEX idx_negocios_categoria ON negocios(categoria_id);
CREATE INDEX idx_negocios_estado    ON negocios(estado);

-- ============================================================
-- 4. ubicaciones
-- ============================================================
-- GEOGRAPHY (no GEOMETRY) porque calcula distancias sobre la superficie
-- curva de la Tierra en metros reales. El índice GIST es lo que permite
-- que una consulta de "negocios a menos de 2 km" (ST_DWithin) sea rápida
-- incluso con miles de registros — no omitirlo nunca. El índice único
-- parcial (WHERE es_actual) garantiza, a nivel de base de datos, que un
-- negocio nunca tenga más de una ubicación marcada como actual a la vez.

CREATE TABLE ubicaciones (
  id                    UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id            UUID NOT NULL REFERENCES negocios(id)
                          ON DELETE CASCADE,
  tipo                  tipo_ubicacion NOT NULL,
  direccion_referencia  VARCHAR(255),
  punto                 GEOGRAPHY(Point, 4326) NOT NULL,
  es_actual             BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ubicaciones_punto
  ON ubicaciones USING GIST(punto);

CREATE UNIQUE INDEX idx_ubicaciones_actual_unica
  ON ubicaciones(negocio_id) WHERE es_actual;

-- ============================================================
-- 5. productos
-- ============================================================

CREATE TABLE productos (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id)
                    ON DELETE CASCADE,
  categoria_id    SMALLINT REFERENCES categorias(id)
                    ON DELETE SET NULL,
  nombre          VARCHAR(150) NOT NULL,
  descripcion     TEXT,
  precio          DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
  disponible      BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_negocio ON productos(negocio_id);

-- ============================================================
-- 6. fotos
-- ============================================================
-- El CHECK chk_fotos_referencia impide, a nivel de base de datos, una
-- foto huérfana o ambigua entre negocio y producto.

CREATE TABLE fotos (
  id                    UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id            UUID REFERENCES negocios(id)
                          ON DELETE CASCADE,
  producto_id           UUID REFERENCES productos(id)
                          ON DELETE CASCADE,
  tipo                  tipo_foto NOT NULL,
  url                   VARCHAR(500) NOT NULL,
  orden_visualizacion   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fotos_referencia CHECK (
    (tipo = 'negocio'  AND negocio_id  IS NOT NULL AND producto_id IS NULL) OR
    (tipo = 'producto' AND producto_id IS NOT NULL)
  )
);

CREATE INDEX idx_fotos_negocio  ON fotos(negocio_id);
CREATE INDEX idx_fotos_producto ON fotos(producto_id);

-- ============================================================
-- 7. horarios
-- ============================================================
-- UNIQUE(negocio_id, dia) impide dos horarios distintos para el mismo
-- negocio el mismo día de la semana.

CREATE TABLE horarios (
  id              BIGSERIAL PRIMARY KEY,
  negocio_id      UUID NOT NULL REFERENCES negocios(id)
                    ON DELETE CASCADE,
  dia             dia_semana NOT NULL,
  hora_apertura   TIME,
  hora_cierre     TIME,
  cerrado         BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (negocio_id, dia),
  CONSTRAINT chk_horarios_rango CHECK (
    cerrado OR (hora_apertura IS NOT NULL AND hora_cierre IS NOT NULL)
  )
);

-- ============================================================
-- 8. resenas
-- ============================================================
-- UNIQUE(negocio_id, usuario_id) implementa directamente en la base de
-- datos la regla RF-015 (una sola reseña por usuario y negocio).

CREATE TABLE resenas (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id          UUID NOT NULL REFERENCES negocios(id)
                        ON DELETE CASCADE,
  usuario_id          UUID NOT NULL REFERENCES usuarios(id)
                        ON DELETE CASCADE,
  calificacion        SMALLINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario          TEXT,
  estado_moderacion   estado_moderacion NOT NULL DEFAULT 'pendiente',
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, usuario_id)
);

CREATE INDEX idx_resenas_negocio ON resenas(negocio_id);

-- ============================================================
-- 9. favoritos
-- ============================================================
-- Tabla de relación pura (RF-017): la llave primaria compuesta ya impide
-- duplicados, no necesita un id propio.

CREATE TABLE favoritos (
  usuario_id      UUID NOT NULL REFERENCES usuarios(id)
                    ON DELETE CASCADE,
  negocio_id      UUID NOT NULL REFERENCES negocios(id)
                    ON DELETE CASCADE,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, negocio_id)
);

-- ============================================================
-- 10. promociones
-- ============================================================

CREATE TABLE promociones (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id)
                    ON DELETE CASCADE,
  titulo          VARCHAR(150) NOT NULL,
  descripcion     TEXT,
  fecha_inicio    TIMESTAMPTZ NOT NULL,
  fecha_fin       TIMESTAMPTZ NOT NULL,
  activa          BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT chk_promociones_fechas CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_promociones_negocio_activa
  ON promociones(negocio_id) WHERE activa;

-- ============================================================
-- 11. eventos
-- ============================================================
-- BIGSERIAL (no UUID) porque es una tabla de registro interno de alto
-- volumen sin uso como identificador público. usuario_id y negocio_id son
-- opcionales (ON DELETE SET NULL) porque un evento puede no tener usuario
-- (búsqueda anónima) o no tener negocio (búsqueda sin resultados).

CREATE TABLE eventos (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  negocio_id      UUID REFERENCES negocios(id) ON DELETE SET NULL,
  tipo            tipo_evento NOT NULL,
  metadatos       JSONB,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_tipo_fecha ON eventos(tipo, fecha_creacion);

-- ============================================================
-- 12. consentimientos
-- ============================================================
-- texto_version guarda a qué versión exacta del texto legal aceptó la
-- persona (Ley 1581 de 2012). otorgado_por_terceros distingue el caso de
-- registro asistido (RF-018).

CREATE TABLE consentimientos (
  id                      BIGSERIAL PRIMARY KEY,
  usuario_id              UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  negocio_id              UUID REFERENCES negocios(id) ON DELETE SET NULL,
  tipo                    tipo_consentimiento NOT NULL,
  otorgado_por_terceros   BOOLEAN NOT NULL DEFAULT false,
  texto_version           VARCHAR(20) NOT NULL,
  fecha_otorgado          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_origen               INET
);

CREATE INDEX idx_consentimientos_usuario ON consentimientos(usuario_id);
