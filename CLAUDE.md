# RUTEANDO — contexto del proyecto para Claude Code

> Este archivo se coloca en la raíz del repositorio. Claude Code lo lee
> automáticamente como contexto persistente del proyecto. Está escrito para
> ser tan específico como sea posible: cada decisión ya fue tomada y
> justificada en la serie de documentos de especificación (01, 03–15) que
> respalda este proyecto — este archivo es su traducción a instrucciones
> operativas, no una nueva fuente de decisiones.

## 0. Qué es este proyecto (una frase)

Plataforma de geolocalización que conecta consumidores con vendedores de
comida callejera y gastronomía informal en Ciudad Verde, Soacha, Colombia.
Un vendedor se registra sin necesidad de registro mercantil ni facturación
electrónica; un consumidor lo encuentra en un mapa y lo contacta
directamente por WhatsApp. No hay pago ni pedido dentro de la aplicación.

## 1. Estado real del proyecto (léase antes de escribir código)

No existe código previo. Todo lo que sigue es una traducción de una
especificación completa y verificada (13 documentos de soporte) a tareas de
implementación. Cuando este archivo y el código entren en conflicto con algo
que parezca más simple o más "estándar", **gana la especificación** — cada
decisión aquí tiene una razón ya documentada, no es arbitraria.

Este archivo asume que Claude Code se usa **épica por épica**, no de una
sola vez: pide una épica completa (sección 6), revisa y prueba el
resultado, haz commit, y solo entonces pasas a la siguiente. Pedir "constrúyeme
toda la aplicación" en un solo prompt produce peor resultado que seguir esta
secuencia, incluso siendo la misma información de entrada.

## 2. Stack técnico (versiones verificadas, no asumidas)

- Backend: Node.js 24 (LTS activo).
- Base de datos: PostgreSQL 18 con extensión PostGIS 3.6.
- API: REST especificada completa en OpenAPI 3.1 (ver `openapi.yaml`, 32
  rutas / 45 operaciones — pégala en el repo antes de empezar la Épica 1;
  es el contrato, no una referencia opcional).
- Almacenamiento de archivos: compatible con S3 (Cloudflare R2 o Backblaze
  B2) para fotos de negocios y productos, con compresión automática antes
  de guardarse (RF-007).
- Hosting sugerido: Render o Railway. **Advertencia verificada**: Railway no
  agrega PostGIS por defecto a su plantilla estándar de Postgres —
  verificar soporte de PostGIS antes de elegir proveedor, o usar Supabase o
  Neon para la base de datos.
- Frontend: cliente móvil/web (sin nativo obligatorio) que consume
  exclusivamente la API — nunca acceso directo a la base de datos desde el
  cliente.
- Observabilidad desde el primer despliegue, no como capa posterior:
  logging estructurado, registro de errores centralizado, alertas sobre
  tasa de error, disponibilidad y latencia.

## 3. Reglas de seguridad no negociables

Estas reglas vienen del checklist de seguridad (basado en OWASP API
Security Top 10 y NIST SP 800-63B) y aplican a **toda** épica, no solo a la
de autenticación:

1. Nunca confiar en información enviada por el cliente sin volver a
   validarla en el servidor — este es el principio rector de todo el diseño.
2. Autorización a nivel de objeto en cada endpoint que reciba un ID (evitar
   IDOR/BOLA): verificar que el usuario autenticado sea dueño del recurso
   antes de permitir editarlo o borrarlo (aplica sobre todo a
   `/businesses/{businessId}`, `/products/{productId}`,
   `/photos/{photoId}`).
3. Autorización a nivel de función: los endpoints bajo `/admin/*` deben
   rechazar con 403 a cualquier usuario cuyo `rol_usuario` no sea
   `administrador`, verificado en middleware, no solo ocultando el botón en
   el frontend.
4. Contraseñas: hash con un algoritmo lento (bcrypt o argon2), nunca
   texto plano ni hash rápido (MD5/SHA1/SHA256 solos).
5. Prevención de inyección SQL: usar siempre consultas parametrizadas o un
   query builder/ORM; nunca concatenar strings en SQL.
6. Validar tipo, rango y formato de cada campo de entrada, incluyendo
   coordenadas geográficas (latitud entre -90 y 90, longitud entre -180 y
   180, y idealmente un chequeo de que caen dentro de un rango razonable
   para Soacha/Cundinamarca).
7. Validar archivos subidos (fotos): tipo MIME real (no solo la extensión),
   tamaño máximo, y siempre recomprimir/reescribir la imagen en el
   servidor antes de guardarla.
8. Prevención de XSS: nunca insertar texto de usuario (nombre de negocio,
   reseña) directamente en HTML sin escapar.
9. Tokens de acceso de corta duración con renovación rotativa (ver
   `/auth/refresh`), alineado con OAuth 2.0 Security BCP (RFC 9700).
10. Errores de API en formato RFC 9457 (Problem Details) — nunca un stack
    trace ni un mensaje de error genérico sin estructura.

## 4. Reglas de privacidad (Ley 1581 de 2012)

- Ningún dato personal se recolecta sin consentimiento explícito previo
  (tabla `consentimientos`, endpoint `/consents`). El registro de un
  usuario no está completo hasta que exista al menos un consentimiento de
  tipo `tratamiento_datos` y uno de `terminos_condiciones`.
- La ubicación del negocio (pública, necesaria para el producto) y la
  ubicación del consumidor (usada solo para calcular cercanía, nunca
  almacenada de forma persistente salvo que el propio usuario la guarde
  como preferencia) se tratan de forma diferenciada — no usar la misma
  lógica de almacenamiento para ambas.
- La plataforma es intermediaria de información, no parte de la
  transacción de compraventa — esto debe reflejarse en los textos legales
  del frontend (términos y condiciones), no solo en la documentación.

## 5. Modelo de datos (referencia exacta — no reinventar nombres)

8 tipos enumerados ya definidos:

```
rol_usuario:          consumidor | vendedor | administrador
estado_negocio:        pendiente | activo | suspendido | cerrado
tipo_ubicacion:        fija | movil | puesto | local | desde_casa | temporal
tipo_foto:             negocio | producto
estado_moderacion:     pendiente | aprobada | rechazada
dia_semana:            lunes..domingo
tipo_evento:           busqueda | vista_negocio | vista_producto |
                       clic_contacto | favorito_agregado | resena_creada |
                       registro_negocio
tipo_consentimiento:   tratamiento_datos | terminos_condiciones |
                       registro_asistido | notificaciones
```

12 tablas ya diseñadas (nombres exactos, en español, no traducir a
inglés): `usuarios`, `categorias`, `negocios`, `ubicaciones`, `productos`,
`fotos`, `horarios`, `resenas`, `favoritos`, `promociones`, `eventos`,
`consentimientos`. Todas usan UUID v7 como llave primaria pública, salvo
`eventos` (entero autoincremental, por volumen). El DDL completo, ya
verificado ejecutándolo contra una base PostgreSQL + PostGIS real, está en
`schema.sql` (junto a este archivo) — aplícalo como primera migración en
vez de pedirle a Claude Code que regenere el esquema desde cero, para no
perder las decisiones ya justificadas (por ejemplo, por qué `ubicaciones`
es una tabla separada de `negocios` y no columnas sueltas, o por qué
`ubicaciones.punto` necesita el índice GIST para que las consultas de
proximidad de la Épica 4 sean rápidas). Nota de versión: `schema.sql` usa
`uuidv7()` (nativa desde PostgreSQL 18); si el entorno de desarrollo corre
una versión anterior, sustituir por `gen_random_uuid()` — el resto del
diseño es idéntico.

## 6. Secuencia de implementación — épica por épica

Cada épica corresponde a una rama `feature/<nombre>` (ver sección 7), a un
grupo de requisitos funcionales (RF) del Documento 05, y a un subconjunto de
las 32 rutas de `openapi.yaml`. **No avanzar a la siguiente épica sin que la
anterior tenga sus pruebas pasando.**

### Épica 0 — Preparación (antes de la Épica 1)

1. Inicializar el repositorio con la estrategia de ramas de la sección 7.
2. Crear el proyecto Node.js 24, con estructura de carpetas por capa
   (rutas, controladores, servicios, acceso a datos) — pedir a Claude Code
   que proponga la estructura, pero fijarla antes de escribir la primera
   ruta real, para que todas las épicas siguientes sean consistentes.
3. Levantar PostgreSQL 18 local con la extensión PostGIS 3.6 habilitada
   (`CREATE EXTENSION postgis;`).
4. Aplicar `schema.sql` (sección 5) como primera migración, usando una
   herramienta de migraciones versionadas en vez de correr el archivo suelto
   a mano — así queda registrado como el punto de partida versionado del
   esquema.
5. Configurar variables de entorno separadas por ambiente
   (`.env.development`, nunca committeadas) siguiendo la tabla de variables
   del Documento 14, sección 1.4.
6. Configurar el pipeline de CI/CD simple (sección 8) antes de escribir
   lógica de negocio, para que desde el primer Pull Request ya corran
   pruebas automáticas.

### Épica 1 — Autenticación y cuentas (RF-001 a RF-003)

Rutas: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/logout`, `GET /users/me`.

Tareas:
1. Registro con correo y contraseña, hash con bcrypt/argon2 (regla de
   seguridad #4).
2. Login que devuelve un access token de corta duración y un refresh token
   rotativo (regla de seguridad #9).
3. Endpoint `/users/me` que devuelve el usuario autenticado según el token,
   nunca según un ID en la URL o el body.
4. Recuperación de contraseña (RF-003) mediante enlace o código de un solo
   uso con expiración corta.
5. Pruebas: al menos los casos de prueba del catálogo del Documento 12 que
   correspondan a RF-001–003; incluir un caso que verifique que un token
   expirado o inválido es rechazado.

### Épica 2 — Negocios y ubicación (RF-004, RF-005, RF-024, RF-025)

Rutas: `POST /businesses`, `GET/PATCH /businesses/{businessId}`,
`PATCH /businesses/{businessId}/location`, `POST /businesses/{businessId}/schedule`.

Tareas:
1. Alta de negocio (nombre, descripción, categoría, tipo de negocio) —
   objetivo explícito: que el flujo completo (RF-004 a RF-008) tome menos de
   10 minutos (RNF-013); no agregar campos obligatorios que no estén en la
   especificación.
2. Registro de ubicación en tabla `ubicaciones` (no como columnas sueltas
   en `negocios`): coordenadas, `tipo_ubicacion`, referencia textual.
   Validar coordenadas (regla de seguridad #6).
3. Un negocio nuevo entra en `estado_negocio = 'pendiente'`; solo aparece en
   búsquedas/mapa cuando un administrador lo aprueba (Épica 9) — no
   implementar la Épica 4 asumiendo que todo negocio es visible de
   inmediato.
4. RF-024: permitir actualizar ubicación/disponibilidad en cualquier
   momento, con autorización a nivel de objeto (regla de seguridad #2).
5. RF-025: endpoint para que cualquier usuario reporte información
   desactualizada — **este endpoint no existe todavía en `openapi.yaml`
   según el Documento 14; agregarlo aquí junto con su definición OpenAPI**,
   no dejarlo pendiente para después.

### Épica 3 — Productos y menú (RF-006 a RF-008)

Rutas: `POST/GET /businesses/{businessId}/products`,
`PATCH/DELETE /products/{productId}`,
`POST /businesses/{businessId}/photos`, `POST /products/{productId}/photos`,
`DELETE /photos/{photoId}`, `POST /businesses/{businessId}/schedule`.

Tareas:
1. CRUD de productos con nombre, precio, descripción, disponibilidad, foto.
2. Carga de fotos con compresión automática en el servidor (regla de
   seguridad #7) antes de subir al almacenamiento S3-compatible.
3. Horario por día de la semana (`dia_semana`), usado después para calcular
   "abierto ahora" en la Épica 4.

### Épica 4 — Descubrimiento: mapa y búsqueda (RF-009 a RF-011)

Rutas: `GET /businesses/nearby`, `GET /businesses` (con filtros), `GET /categories`.

Esta es la épica más sensible en rendimiento — tratarla con más cuidado que
las demás:

1. Consulta de proximidad con PostGIS (`ST_DWithin` / índice GIST sobre la
   columna geográfica) — confirmar que el índice espacial existe antes de
   medir cualquier tiempo de respuesta.
2. Filtros combinables: distancia, rango de precio, "abierto ahora"
   (calculado contra `horarios` y la hora actual, no un campo booleano
   manual).
3. Búsqueda por texto (nombre o tipo de producto) y por categoría —
   considerar un índice de texto (`pg_trgm` o similar) si la búsqueda por
   nombre resulta lenta con datos reales.
4. Solo deben aparecer negocios con `estado_negocio = 'activo'`.
5. **Escribir aquí una prueba de carga básica** (con k6 o Artillery) contra
   `/businesses/nearby` simulando el volumen esperado de consultas
   concurrentes, antes de dar por cerrada esta épica — el plan de pruebas
   original (Documento 12) no incluye pruebas de carga, y este es
   justamente el endpoint donde más importan.

### Épica 5 — Perfil de negocio y contacto (RF-012 a RF-014)

Rutas: `GET /businesses/{businessId}`, `POST /events` (para registrar clics).

1. Perfil público con fotos, menú, ubicación, horario, calificación
   promedio y reseñas.
2. Botón de WhatsApp: enlace `wa.me` con mensaje prellenado — registrar un
   evento `tipo_evento = 'clic_contacto'` en cada clic (RF-023).
3. Botón "Cómo llegar": enlace externo a Google Maps/Waze con las
   coordenadas — no reimplementar navegación dentro de la app.

### Épica 6 — Reseñas y reportes (RF-015, RF-016)

Rutas: `POST /businesses/{businessId}/reviews`, `POST /reviews/{reviewId}/report`.

1. Una reseña por usuario y negocio (constraint único a nivel de base de
   datos, no solo validación en el backend).
2. Reporte de reseña o foto por contenido inapropiado → pasa a
   `estado_moderacion = 'pendiente'` para la Épica 9.

### Épica 7 — Favoritos (RF-017)

Rutas: `POST/DELETE /businesses/{businessId}/favorite`,
`GET /users/me/favorites`. La más simple del backlog — no sobre-diseñarla.

### Épica 8 — Privacidad y consentimiento (RF-018)

Rutas: `POST /consents`, `GET /users/me/consents`.

1. Aviso de privacidad mostrado antes de recolectar cualquier dato
   personal.
2. Registro de consentimiento explícito por tipo (`tipo_consentimiento`),
   con fecha y versión del texto legal aceptado — nunca un booleano simple
   "aceptó sí/no" sin trazabilidad de qué texto aceptó.

### Épica 9 — Administración y moderación (RF-019 a RF-023)

Rutas: `GET /admin/businesses/pending`,
`POST /admin/businesses/{businessId}/approve`,
`POST /admin/businesses/{businessId}/reject`,
`GET /admin/reviews/reported`, `POST /admin/reviews/{reviewId}/moderate`,
`GET /admin/metrics`.

1. Todas las rutas `/admin/*` protegidas por autorización a nivel de
   función (regla de seguridad #3).
2. Aprobar/rechazar negocios pendientes; moderar reseñas/fotos reportadas.
3. Métricas básicas: negocios activos, usuarios registrados, búsquedas y
   contactos generados — usar la tabla `eventos`, no recalcular desde cero.
4. **Tres endpoints administrativos faltantes, identificados en el
   Documento 14 y no presentes en la especificación original — agregarlos
   en esta épica**: suspender un usuario, marcar como atendido un reporte
   de "información desactualizada" (RF-025), y exportar reportes/métricas
   en un formato estructurado (RF-022).

## 7. Convención de ramas y commits

Tres tipos de rama únicamente (no las seis de Git Flow completo):

- `main` — desplegable, nunca se edita directamente.
- `develop` — integración de features antes de pasar a `main`.
- `feature/<nombre>`, `fix/<nombre>`, `hotfix/<nombre>` — de vida corta,
  minúsculas con guiones (ej. `feature/business-registration`,
  `feature/map-search`).

Commits en formato Conventional Commits 1.0.0 (`feat:`, `fix:`, `chore:`,
`test:`, etc.). Cada Pull Request hacia `develop` requiere: estilo/lint en
verde, pruebas unitarias e de integración en verde, y revisión humana antes
de fusionar — no fusionar con CI en rojo aunque el cambio "se vea bien".

## 8. Pruebas — mínimo por épica

Cada épica debe cerrar con, como mínimo:

- Pruebas unitarias de la lógica de negocio (validaciones, cálculos).
- Pruebas de integración contra una base de datos Postgres/PostGIS real
  (contenedor de servicio en CI, no mocks de la base de datos).
- Los casos de prueba correspondientes del catálogo de 25 del Documento 12.
- Para la Épica 4 específicamente: una prueba de carga (ver sección 6).
- Para cualquier endpoint con autenticación: al menos un caso que pruebe el
  rechazo (401/403) con un token inválido, ausente o de un usuario sin
  permiso.

No declarar una épica "terminada" solo porque el endpoint responde 200 en
el caso feliz — eso es necesario, no suficiente.

## 9. Ambientes

Tres ambientes con bases de datos y credenciales completamente
independientes: `development` (local), `staging` (previo a producción, para
validación manual antes del primer lanzamiento) y `production`. Nunca
desarrollar directamente sobre `production`. El pipeline de CI/CD despliega
automáticamente a `staging` desde `develop`, y a `production` desde `main`
tras revisión humana.

## 10. Gaps conocidos que Claude Code debe tener presentes

Estos son hallazgos ya documentados durante la elaboración de la propia
especificación — no son errores de este archivo, son pendientes reales que
alguien tiene que cerrar durante la implementación:

- Inconsistencia de etiquetado: algunos endpoints de ubicación quedaron
  etiquetados como RF-006 en vez de RF-005 en el Documento 09 — corregir la
  trazabilidad al escribir los comentarios/documentación del código, no
  solo al escribir el código.
- Faltan en la especificación original (agregar en la épica que
  corresponda, ver sección 6): endpoint para suspender un usuario,
  endpoint para reportar negocio desactualizado, endpoint de exportación de
  reportes.
- Épica 1: `POST /auth/logout` no tenía `requestBody` en `openapi.yaml`
  pese a que su propósito es "invalidar el refresh token actual" — sin el
  token en el body no hay forma de saber cuál revocar. Se le agregó
  `{refreshToken}` al body (ahora revoca solo ese token, no todos los del
  usuario).
- Épica 1: RF-003 (recuperación de contraseña) no tenía rutas en
  `openapi.yaml` ni estaba en la lista de rutas de la Épica 1. Se agregaron
  `POST /auth/forgot-password` y `POST /auth/reset-password`. Como todavía
  no hay proveedor de correo elegido (no está en la tabla de variables del
  Documento 14), el envío real de email queda pendiente: por ahora el
  enlace/token se registra en el log estructurado (pino) en vez de
  enviarse — ver comentario `TODO` en `src/services/passwordReset.service.js`
  cuando se implemente.
- Épica 2: la prosa de la sección 6 dice "PATCH /businesses/{businessId}/location"
  y "POST /businesses/{businessId}/schedule", pero `openapi.yaml` define
  ambos como `PUT` (con su `GET` correspondiente para leer el valor
  vigente). Se implementó el contrato real (`PUT`), no la prosa — si en
  algún momento se vuelve a citar esta sección, corregir la cita.
- Épica 2: RF-025 (reportar negocio con información desactualizada) no
  tenía ruta ni tabla en la especificación original. Se agregó
  `POST /businesses/{businessId}/outdated-reports` (público; si el
  cliente manda un Bearer token válido, el reporte queda asociado a ese
  usuario) y la tabla `reportes_negocio`, con `atendido_en` nullable para
  que la Épica 9 pueda marcarlo atendido sin otra migración. Además, es
  público sin límite de abuso por defecto — se agregó un límite de 3
  reportes por negocio + origen (usuario autenticado, o IP si es anónimo)
  cada 10 minutos (`OUTDATED_REPORT_RATE_LIMIT_MAX`/`_WINDOW_MINUTES` en
  `src/config/constants.js`), respaldado en base de datos (columna
  `ip_origen` en `reportes_negocio`, mismo tipo que `consentimientos`) en
  vez de un limitador en memoria, para que sobreviva reinicios y funcione
  igual con más de una instancia corriendo. Requirió `app.set('trust
  proxy', 1)` en `src/app.js` para que `req.ip` sea la IP real del
  cliente detrás del proxy de Render/Railway.
- Hallazgo preexistente en `openapi.yaml` (ya estaba en el primer commit,
  `6f7debc`, antes de la Épica 1): el archivo tenía **dos claves
  `components:` de nivel superior** (una con `securitySchemes`,
  `parameters` y `responses`; otra, más abajo, solo con `schemas`). YAML
  no fusiona claves duplicadas — la segunda pisaba completamente a la
  primera, así que **todos** los `$ref` a `#/components/parameters/*` y
  `#/components/responses/*`, y el propio `security: [bearerAuth: []]`
  global, apuntaban a algo que un parser estricto no encontraría. Se
  fusionaron ambos bloques en una sola clave `components:` (sección 6,
  Épica 2) y se verificó programáticamente que los 30 `$ref` del
  documento resuelven. Si algún PR anterior citó rutas/parámetros de
  `openapi.yaml` asumiendo que esto ya funcionaba, no fue así hasta este
  fix.
- El plan de pruebas no incluye pruebas de carga/estrés — agregarlas para
  la Épica 4 como mínimo.
- Épica 3: la sección 6 lista `POST /businesses/{businessId}/schedule`
  como parte de esta épica, pero ese endpoint (RF-008) ya se implementó
  completo en la Épica 2 (commit `fc9c729`), junto con negocios/ubicación
  — la prosa quedó desalineada, no el código. El alcance real de la
  Épica 3 fue solo productos y fotos (RF-006, RF-007).
- Épica 3: las 6 rutas de productos/fotos no tenían respuestas de error
  (`401/403/404/422`) declaradas en `openapi.yaml`, a diferencia de
  `outdated-reports`. Se agregaron, junto con un parámetro `PhotoId`
  reusable (antes `photoId` se definía inline solo en
  `/photos/{photoId}`, sin seguir el mismo patrón que `BusinessId`/
  `ProductId`/`ReviewId`). Se verificó programáticamente que los 127
  `$ref` del documento siguen resolviendo.
- Épica 3 (RF-007, fotos): no había dependencias para recibir
  `multipart/form-data` (Express 5 no lo parsea solo), comprimir imágenes
  ni hablar con un backend S3-compatible. Se agregaron `multer`
  (parseo, en memoria, sin tocar disco), `sharp` (compresión) y
  `@aws-sdk/client-s3` (compatible con R2/B2/MinIO vía `endpoint` +
  `forcePathStyle: true`). La verificación real de tipo MIME (regla de
  seguridad #7) no usa una librería de sniffing aparte: Sharp decodifica
  el buffer y se compara el `format` que detecta (no el `Content-Type`
  que declaró el cliente) contra una lista de formatos permitidos — un
  SVG renombrado a `.jpg` se rechaza porque Sharp lo detecta como `svg`,
  no como `jpeg`/`png`/`webp` (ver `src/services/imagen.service.js` y su
  prueba unitaria). Valores fijos elegidos (no son variables de entorno,
  igual que los límites de RF-025): `PHOTO_MAX_SIZE_BYTES` = 8 MB (tamaño
  crudo antes de recomprimir), salida siempre reescrita como JPEG calidad
  80 con el lado más largo limitado a 1600px — ver
  `src/config/constants.js`.
- Épica 3: `STORAGE_ENDPOINT=http://localhost:9000` ya estaba en
  `.env.example`/`.env.development`/`ci.yml` desde la Épica 2 (puerto por
  defecto de MinIO), pero ningún servicio lo levantaba — no existía forma
  de correr una prueba de integración real de subida/borrado de fotos.
  Se agregó MinIO a `docker-compose.yml` (con un contenedor `minio-init`
  de un solo uso que crea el bucket `ruteando-media-dev` al levantar el
  stack) y como service container en `ci.yml` (con un paso `mc mb` antes
  de `npm test` para crear `ruteando-media-ci`) — mismo principio que ya
  se sigue con Postgres: nada de mocks contra el almacenamiento.
- Épica 3: borrar una foto (`DELETE /photos/{photoId}`) borra primero la
  fila en `fotos` y luego, best-effort, el objeto remoto (si el storage
  falla, no bloquea el borrado, solo queda un log de advertencia) — en ese
  orden porque si el proceso se cae entre medio, el peor caso es un objeto
  huérfano en el bucket, nunca una fila que sigue apuntando a un archivo
  que ya no existe. (Una revisión posterior con `/ultrareview` encontró
  que la primera versión tenía el orden invertido — borraba el objeto
  remoto antes que la fila, produciendo justo el caso que el comentario
  del código decía estar evitando; corregido.) El `ON DELETE CASCADE` de
  `fotos.producto_id` al borrar un producto (`DELETE /products/{productId}`)
  sí borra las filas en cascada, pero no los objetos en el bucket — el
  service de productos lista las fotos del producto antes de borrarlo y
  limpia cada objeto aparte (en paralelo con `Promise.allSettled`, no en
  serie). No existe todavía un job de limpieza de huérfanos para el caso
  en que el proceso se caiga a mitad de esa limpieza, ni para cuando falla
  el INSERT de una foto después de que el objeto ya se subió al bucket
  (ese segundo caso sí se cubre con un cleanup explícito en
  `fotos.service.js`) — pendiente si en la práctica llega a acumularse
  basura real en el bucket.
- Épica 3, encontrado por `/ultrareview` sobre el PR: el `minio` definido
  bajo `services:` en `ci.yml` nunca arrancaba — la imagen `minio/minio`
  no corre el servidor por defecto (su `CMD` es solo `["minio"]`, sin
  `server /data`) y el mecanismo `services:` de GitHub Actions no permite
  pasar un comando (no hay `command:`, y `options:` son flags de
  `docker create`, no argumentos después de la imagen). El health-check
  nunca hubiera pasado y el job habría fallado en cada push/PR. Se
  reemplazó por un paso explícito que levanta MinIO con
  `docker run ... minio/minio:latest server /data` (igual que
  `docker-compose.yml`) y espera a que responda antes de crear el bucket.
- Épica 3, encontrado por `/ultrareview`: `fotos.url` se construía como
  `STORAGE_ENDPOINT + bucket + key`, pero `STORAGE_ENDPOINT` es el
  endpoint de la API S3 contra el que el SDK firma `PUT`/`DELETE` — en R2/B2
  real ese host no sirve lectura pública anónima de los objetos (401/403),
  así que la URL guardada no era la que un cliente podía usar para
  mostrar la foto. Se agregó `STORAGE_PUBLIC_URL` (opcional, obligatoria
  en `production` vía `env.js`) como la base de lectura pública real
  (bucket público de R2, dominio custom, o el CDN delante de B2); si no
  está configurada se usa `STORAGE_ENDPOINT` como respaldo, correcto solo
  en dev/CI con MinIO (donde ese mismo endpoint sí es alcanzable por el
  cliente).
- Épica 3, encontrado por `/ultrareview`: `sharp(buffer).metadata()` solo
  lee el encabezado del archivo, no decodifica los píxeles — un archivo de
  pocos KB puede declarar dimensiones enormes y decodificar a cientos de
  MB o más de 1 GB en RAM al procesarlo con `.resize()/.toBuffer()`
  ("bomba de descompresión"), y cualquier vendedor autenticado puede
  subir fotos. Se agregó `PHOTO_MAX_INPUT_PIXELS` (40 millones de píxeles,
  cubre con margen la cámara de celular más exigente en uso normal) como
  chequeo explícito sobre `metadata.width/height` antes de decodificar, y
  como `limitInputPixels` al decodificar de verdad (red de seguridad para
  el caso de que el encabezado no refleje lo que realmente se decodifica).
- Épica 3, encontrado por `/ultrareview`: el cálculo de
  `orden_visualizacion` (`MAX(orden_visualizacion) + 1`) se hacía con un
  `SELECT` separado del `INSERT`, sin ningún lock — dos subidas casi
  simultáneas del mismo negocio/producto podían calcular el mismo
  "siguiente" antes de que ninguna hubiera insertado, dejando dos fotos
  empatadas en la misma posición (no hay una fila existente que bloquear
  con `FOR UPDATE` porque el conflicto es sobre un agregado). Se
  reescribió como una sola función transaccional
  (`fotosRepo.crearConOrdenSiguiente`) que toma un
  `pg_advisory_xact_lock` por dueño (negocio o producto) antes de calcular
  e insertar — ver prueba de regresión con subidas concurrentes en
  `tests/integration/photos.test.js`.
- Épica 3, encontrado por `/ultrareview`: `productInputSchema` (compartido
  entre `POST` y `PATCH`, mismo patrón que `businessInputSchema`) tenía
  `available: z.coerce.boolean().default(true)` — zod rellenaba el campo
  con `true` antes de que `productos.service.js` lo viera, así que la
  condición `input.available !== undefined ? ... : producto.disponible`
  del PATCH nunca se cumplía con `undefined`, y cualquier edición parcial
  que no mencionara `available` reactivaba en silencio un producto
  marcado como agotado. Se quitó el `.default()` del schema (queda
  `undefined` de verdad cuando no se envía) y el valor por defecto de
  creación (`true`) se aplica explícitamente en `productos.service.js`,
  no en el validador — ver prueba de regresión en
  `tests/integration/products.test.js`.
- El trabajo de campo con vendedores y consumidores reales de Ciudad Verde
  todavía no se ha ejecutado — los supuestos de UX (Documento 08) están
  bien fundamentados en la literatura pero no en entrevistas propias
  completas; si durante el desarrollo surge evidencia que los contradiga,
  el código puede necesitar ajustarse y **debe documentarse el cambio**, no
  solo aplicarse en silencio.
