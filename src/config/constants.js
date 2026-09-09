// Duraciones fijas por especificación (Documento 14, sección 1.4: "Firma de
// tokens de acceso (15 min)" / "... refresh tokens rotativos (30 días)").
// No son variables de entorno — el documento las trata como parte del
// contrato de JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, no como valores
// configurables por ambiente.
//
// El access token es un JWT (jsonwebtoken usa su propio formato de
// duración, ej. '15m'). El refresh token es una cadena opaca, no un JWT
// (ver src/services/token.service.js) — su expiración se calcula a mano,
// por eso se guarda también en milisegundos.
module.exports = {
  JWT_ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET_CODE_TTL_MS: 15 * 60 * 1000,

  // RF-025 es público (sin auth obligatoria) — límite de abuso por
  // negocio + origen (usuario_id si está logueado, si no ip_origen).
  // 3 en 10 minutos: deja pasar el uso legítimo (alguien nota algo raro y
  // reporta un par de veces) sin permitir un spam sostenido contra un
  // negocio puntual.
  OUTDATED_REPORT_RATE_LIMIT_MAX: 3,
  OUTDATED_REPORT_RATE_LIMIT_WINDOW_MINUTES: 10,

  // RF-007 (fotos de negocio/producto). Fijos por decisión de producto,
  // no por ambiente — igual que los TTL de arriba.
  //
  // 8 MB: el archivo *crudo* que acepta la subida antes de recomprimir.
  // Una foto de celular sin editar pesa fácil 3-8 MB; el objetivo (RNF-013,
  // flujo completo < 10 min) es que el vendedor no tenga que comprimir a
  // mano antes de subir. Multer rechaza lo que pase de aquí antes de que
  // llegue a Sharp.
  PHOTO_MAX_SIZE_BYTES: 8 * 1024 * 1024,

  // Filtro rápido en Multer por el Content-Type que declara el cliente —
  // no es la verificación real de seguridad #7 (ver imagen.service.js,
  // que decodifica el buffer con Sharp y compara el formato *detectado*,
  // no el declarado). Deliberadamente sin image/svg+xml: un SVG puede
  // llevar <script>, nunca se acepta como "imagen" subida por usuario.
  PHOTO_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  // Mismo conjunto que arriba pero en el vocabulario de formato que usa
  // Sharp (metadata().format), para la verificación real post-decodificado.
  PHOTO_ALLOWED_SHARP_FORMATS: ['jpeg', 'png', 'webp'],

  // Toda foto se reescribe siempre como JPEG antes de guardarse
  // (normaliza el formato de almacenamiento, sin importar el de entrada).
  PHOTO_MAX_DIMENSION_PX: 1600,
  PHOTO_JPEG_QUALITY: 80,

  // Límite de "bomba de descompresión": PHOTO_MAX_SIZE_BYTES acota el
  // archivo comprimido, no lo que Sharp asigna en memoria al decodificarlo
  // — un PNG de pocos KB con dimensiones declaradas enormes puede
  // decodificar a más de 1 GB en RAM (el límite por defecto de Sharp es
  // ~268M píxeles). 40 millones de píxeles cubre con margen hasta la
  // cámara de celular más exigente en uso normal (~40 MP) y acota la
  // asignación real a un tamaño razonable.
  PHOTO_MAX_INPUT_PIXELS: 40_000_000,

  // RF-013/023 (POST /events, Épica 5) — público (auth opcional), límite
  // de abuso por origen (usuario_id si está logueado, si no ip_origen;
  // ver migración eventos-ip-origen). A diferencia de
  // OUTDATED_REPORT_RATE_LIMIT_MAX (una acción deliberada y rara), un
  // evento es tráfico de analítica normal: una sola sesión de navegación
  // genera fácilmente decenas (búsquedas, vistas, clics), así que el
  // límite tiene que ser mucho más generoso — 60 por minuto deja pasar
  // uso legítimo sin permitir una inundación trivial del endpoint o de
  // las métricas que la Épica 9 va a leer de esta misma tabla. Supuesto
  // propio, no una cifra citada de ningún documento.
  EVENT_RATE_LIMIT_MAX: 60,
  EVENT_RATE_LIMIT_WINDOW_MINUTES: 1,

  // metadata (JSONB, additionalProperties: true) es un campo libre de un
  // cliente que puede ser anónimo — sin tope, es un vector fácil para
  // llenar la tabla de basura (regla de seguridad #1). 2 KB alcanza de
  // sobra para lo que un evento de analítica necesita guardar (ej. el
  // texto buscado, el id del producto visto).
  EVENT_METADATA_MAX_BYTES: 2048,

  // RF-016 (reportar reseña, Épica 6) — a diferencia de RF-025, reportar
  // una reseña siempre requiere autenticación (no es anónimo), así que
  // esta es la segunda capa de defensa (la primera es el UNIQUE
  // (resena_id, usuario_id) en reportes_resena, que por sí solo ya
  // impide que UN mismo usuario tumbe la misma reseña dos veces): cubre
  // una cuenta reportando muchas reseñas *distintas* rápido. Es una
  // acción deliberada y rara, igual que RF-025 — mismo valor.
  REVIEW_REPORT_RATE_LIMIT_MAX: 3,
  REVIEW_REPORT_RATE_LIMIT_WINDOW_MINUTES: 10,

  // Épica 9 (moderación de fotos, gap dejado pendiente desde la Épica 6) —
  // POST /photos/{photoId}/report siempre requiere autenticación, igual
  // que reportar una reseña (RF-016): mismo valor, mismo razonamiento
  // (acción deliberada y rara, no tráfico de analítica).
  PHOTO_REPORT_RATE_LIMIT_MAX: 3,
  PHOTO_REPORT_RATE_LIMIT_WINDOW_MINUTES: 10,

  // Registro asistido (RF-018, Épica 2) — a diferencia de
  // PASSWORD_RESET_CODE_TTL_MS (15 min, pensado para un enlace que se
  // envía por correo casi al instante), este token se entrega en persona
  // (el administrador se lo da al vendedor directamente) — 15 minutos no
  // alcanza. 7 días es una cifra propia, no citada de ningún documento.
  ASSISTED_CLAIM_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,

  // GET /admin/reports/export (RF-022): tope propio para cada lista de
  // pendientes que incluye el export — no es un endpoint paginado (es un
  // volcado puntual), así que necesita un límite fijo para no arriesgarse
  // a devolver miles de filas si la cola de moderación crece mucho.
  ADMIN_EXPORT_LIST_LIMIT: 100,

  // Confirmación de disponibilidad en tiempo real (CLAUDE.md, sección 11).
  // Ventana para que el vendedor responda antes de que la solicitud
  // expire sola (expiración perezosa, sin cron — se calcula al leer,
  // nunca se escribe). Cifra propia: "¿sigues vendiendo ahora mismo?"
  // pierde sentido si se tarda mucho en responder.
  AVAILABILITY_REQUEST_TTL_MINUTES: 10,

  // Cuánto tiempo después de confirmada sigue mostrándose "confirmado
  // vendiendo ahora" en el perfil público antes de dejar de considerarse
  // vigente. Cifra propia.
  AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES: 60,

  // Doble capa de rate limit, mismo criterio que RF-016/RF-025: por
  // negocio (protege al vendedor de que lo saturen de push, sin importar
  // cuántos consumidores distintos preguntan) y por usuario solicitante
  // (protege contra una sola cuenta acosando a varios negocios). El
  // límite por negocio es más generoso que el de RF-016 a propósito — un
  // negocio popular puede recibir preguntas legítimas de varios
  // consumidores distintos en poco tiempo, no es spam de una sola cuenta.
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_MAX: 5,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_BUSINESS_WINDOW_MINUTES: 30,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_MAX: 3,
  AVAILABILITY_REQUEST_RATE_LIMIT_PER_USER_WINDOW_MINUTES: 10,
};
