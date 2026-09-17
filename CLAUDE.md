# RUTEANDO — contexto del proyecto para Claude Code

**Idioma**: Responde siempre en español en toda comunicación conversacional
con el usuario, sin importar el idioma del código, los mensajes de commit
o el contenido técnico que estés procesando.

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

**Actualización introducida en la Épica 8 (RF-018)**: `login()` y
`refresh()` incorporan una verificación de consentimiento obligatorio
antes de emitir tokens. `register()` no cambia. Ver el detalle de diseño
y la ventana de gracia que esto deja en la sección Épica 8 y en la
sección de gaps conocidos.

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
3. `GET /users/me/consents` usa el middleware `authenticate` estándar de
   la Épica 1 (el mismo de `GET /users/me`) — siempre contra
   `req.user.id`, nunca un id en la URL o el body.
4. `POST /consents` usa un middleware nuevo, `optionalAuthenticate`: valida
   el token si viene, pero si no hay token o es inválido/expirado NO
   rechaza la petición — deja `req.user = null` y el handler decide.
   - Si `req.user` es `null`: por ahora responde 401. El camino para
     registro asistido sin token existe en la ruta (por eso el middleware
     es opcional y no `authenticate` a secas), pero su lógica de negocio
     queda pendiente para cuando se aborde la Épica 2 — no se implementa
     en esta épica (ver gaps conocidos).
   - Si `req.user` existe pero el `usuario_id` del cuerpo no coincide con
     `req.user.id`: 403 (autorización a nivel de objeto, regla de
     seguridad #2).
5. `login()`, después de validar credenciales, y `refresh()`, después de
   validar el refresh token — en ambos casos ANTES de emitir el nuevo par
   de tokens — consultan `consentimientos` filtrando
   `tipo IN ('tratamiento_datos', 'terminos_condiciones')` para ese
   `usuario_id`. Si falta alguno de los dos: no se emiten tokens, se
   responde 403 en formato RFC 9457 (Problem Details) con `type`
   distinguible (`.../errors/consent-required`) y un campo de extensión
   con los tipos faltantes. `register()` no cambia — sigue emitiendo
   tokens de inmediato, sin este chequeo.
6. En `refresh()` específicamente: si el rechazo es por consentimiento
   faltante (no por token inválido), NO se rota ni se invalida el refresh
   token existente — debe seguir sirviendo para el siguiente intento una
   vez el usuario complete el consentimiento. La rotación solo ocurre
   cuando el intercambio efectivamente tiene éxito.

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
  igual con más de una instancia corriendo. Requirió
  `app.set('trust proxy', 1)` en `src/app.js` para que `req.ip` sea la IP
  real del cliente detrás del proxy de Render/Railway.
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
  la Épica 4 como mínimo. **Resuelto (2026-09-09)**: ejecutada con éxito
  contra 5.000 negocios sintéticos (`scripts/seedLoadTest.js`), 50 VUs
  (`scripts/loadtest-nearby.js`, k6) — p95=97.31ms, p99=134.15ms, 0% de
  error sobre 35.891 requests. Los umbrales propios (p95<300ms,
  p99<800ms, error<1%) quedaron todos superados con margen amplio.
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
- Épica 4 (búsqueda geoespacial, RF-009 a RF-011): `openapi.yaml` no
  declaraba en `/businesses/nearby` ninguno de los filtros combinables que
  la prosa de la sección 6 promete (rango de precio, "abierto ahora",
  texto, categoría) — solo tenía `lat/lng/radiusKm/cursor/limit`; y
  `/businesses` no tenía `priceMin/priceMax/openNow`. Se agregaron ambos
  conjuntos de parámetros (`CategoryIdFilter`, `QueryFilter`,
  `PriceMinFilter`, `PriceMaxFilter`, `OpenNowFilter` en
  `components/parameters`), compartidos entre las dos rutas.
- Épica 4: la respuesta de `/businesses/nearby` no incluía la distancia
  que justifica "ordenados por distancia ascendente", y `Business` no
  llevaba coordenadas (una vista de mapa habría necesitado una llamada
  aparte a `GET /businesses/{id}/location` por cada resultado). Se
  agregaron `latitude`/`longitude` (en `/businesses` y `/businesses/nearby`)
  y `distanceMeters` (solo en `/nearby`) directamente al schema `Business`
  — quedan `null` en el resto de las operaciones (POST/PATCH/GET por id),
  que no hacen ese join.
- Épica 4: RF-008 (horario, en teoría cerrado desde la Épica 2) tenía un
  bug real encontrado al diseñar "abierto ahora" — `business.validators.js`
  rechazaba con 422 cualquier horario con `closeTime <= openTime`, lo que
  bloqueaba turnos nocturnos que cruzan medianoche (ej. 18:00–02:00,
  común en comida callejera nocturna) desde `PUT /businesses/{id}/schedule`,
  antes incluso de llegar a esta épica. Se relajó esa regla (solo se
  rechaza `closeTime === openTime`, ambiguo — "cerrado todo el día" vs.
  "abierto 24 horas" no son distinguibles en este esquema, y "24 horas" no
  quedó representable) y se invirtió la prueba unitaria que antes esperaba
  ese 422 (`business.validators.test.js`). Sin migración: `chk_horarios_rango`
  en `schema.sql` nunca exigió `hora_apertura < hora_cierre`, solo que
  ambas existan — el bloqueo era enteramente de la capa de aplicación.
- Épica 4: el cálculo de "abierto ahora" para un turno nocturno necesita
  revisar la fila de horario de HOY y la de AYER (un turno que cruza
  medianoche queda guardado bajo el día en que empieza) — aplicar la regla
  completa (`ahora >= apertura O ahora <= cierre`) contra una sola fila da
  un falso positivo antes de que ese turno empiece (ver el caso exacto,
  con prueba de regresión permanente, en
  `disponibilidad.service.test.js` y `tests/integration/discovery.test.js`).
  La misma regla vive dos veces a propósito: como función pura en JS
  (`disponibilidad.service.js`, testeable sin depender del reloj real) y
  como expresión SQL en `negocios.repository.js#agregarFiltrosComunes` —
  verificada contra la API real con datos sembrados a mano antes de
  escribir las pruebas automatizadas.
- Épica 4: `req.query` en Express 5 es un getter sin setter — el patrón
  de `validateBody` (reemplazar `req.body` por los datos ya
  coercionados/validados) no funciona para query params: asignar
  `req.query = ...` no tira error, pero tampoco cambia nada (verificado
  con una prueba mínima antes de escribir el middleware). Se agregó
  `validateQuery` en `src/middlewares/validate.js`, que deja el resultado
  en `req.validatedQuery` en vez de sobrescribir `req.query`.
- Épica 4: paginación por cursor (`nextCursor` de `Pagination`) implementada
  como keyset, no `OFFSET` — cursor opaco en base64url
  (`src/utils/cursor.js`) con `(distanceMeters, id)` para `/nearby` y
  `(fechaCreacion, id)` para `/businesses`, usando `id` como desempate
  determinístico para que dos negocios a la misma distancia exacta no se
  salten ni se dupliquen entre páginas (probado con coordenadas idénticas
  a propósito, no "simétricas" — `ST_Distance` da el mismo valor exacto
  solo si las coordenadas de entrada son literalmente iguales). Un cursor
  que no decodifica a la forma esperada se rechaza con 422, nunca llega a
  la consulta parametrizada.
- Épica 4: verificado con `EXPLAIN ANALYZE` a mano (8.000 filas sintéticas)
  y luego con una prueba de integración permanente
  (`tests/integration/nearbyIndexPlan.test.js`) que la consulta de
  `/businesses/nearby` usa `idx_ubicaciones_punto` — como `Index Scan`
  simple sin otros filtros, o como `Bitmap Index Scan` combinado con otros
  índices cuando hay más filtros activos (ambos son caminos de acceso por
  índice; ninguno es un seq scan, que es lo único que la prueba prohíbe
  de verdad). Encontrado en el camino: sin `ANALYZE` después de la carga
  masiva de datos sembrados, el planificador usa estadísticas
  viejas/por defecto y puede elegir no pasar por el índice espacial en
  absoluto — la prueba y `scripts/seedLoadTest.js` corren `ANALYZE`
  explícito después de sembrar, no dependen del autoanalyze asíncrono de
  Postgres.
- Épica 4: prueba de carga con k6 (no Artillery — ver decisión en la
  conversación de planeación) contra `GET /businesses/nearby`, con
  `scripts/seedLoadTest.js` sembrando 5.000 negocios representativos
  alrededor de Ciudad Verde antes de correr `scripts/loadtest-nearby.js`.
  Umbrales (`p95<300ms`, `p99<800ms`, error rate `<1%`, 50 VUs
  concurrentes) son **un supuesto propio, no un requisito citado** — no
  hay un RNF de rendimiento documentado en este repositorio para este
  endpoint. Resultado real medido contra los 5.000 negocios sembrados:
  p95≈152ms, 0% de errores, ~450-600 req/s sostenidos con 50 VUs — dentro
  de los umbrales propuestos con margen amplio. No corre dentro de
  `npm test` ni en el pipeline de CI de cada PR (necesita servidor arriba,
  datos sembrados, y tarda más que las pruebas unitarias/integración) —
  queda como paso manual documentado aquí y en los comentarios del script.
- Épica 4: el patrón de `q` (`%${q}%`) siempre viajó como valor ligado
  ($N), nunca concatenado en el texto SQL — no era una inyección SQL. Pero
  sin escapar, `%` y `_` dentro de `q` actuaban como comodines de verdad
  de `ILIKE` (no como texto literal): un negocio llamado con un `%` en el
  nombre generaba coincidencias más amplias de lo esperado, y
  `q=%` a secas matchea "cualquier texto" (comodín de LIKE), devolviendo
  todos los negocios de la categoría en vez de buscar un `%` literal. Se
  agregó `escaparComodinesLike()` en `negocios.repository.js` (escapa
  `\` primero, luego `%` y `_`, con `\` como carácter de escape — el que
  usa Postgres por defecto en LIKE/ILIKE) antes de armar el patrón. Ver
  prueba de regresión con `q=50%` y `q=%` en `discovery.test.js`.
- Épica 5 (perfil de negocio y contacto, RF-012 a RF-014): `Business`
  (el schema liviano que ya usan POST/PATCH/GET-lista/nearby) no alcanza
  para lo que pide RF-012 — ubicación, horario, menú, fotos, calificación
  y reseñas en una sola respuesta. En vez de inflar `Business` (que
  penalizaría cada resultado de una búsqueda), se agregó `BusinessProfile`
  (`allOf: [Business, {...}]`) solo para el `200` de
  `GET /businesses/{businessId}`, compuesto en `perfilNegocio.service.js`
  a partir de los repositorios que ya existían de épicas anteriores
  (`ubicaciones`, `horarios`, `productos`) más uno nuevo
  (`fotos.repository.js#listarPorNegocio`, fotos del negocio + de todos
  sus productos en un solo `UNION ALL`, sin N+1 por producto) y uno
  completamente nuevo (`resenas.repository.js`).
- Épica 5: **la lista completa de reseñas no se embebe** en el perfil —
  solo `averageRating`/`reviewCount` (agregado acotado). La lista vive en
  su propio endpoint paginado (`GET /businesses/{businessId}/reviews`),
  que ya está en `openapi.yaml` pero es responsabilidad de la Épica 6, no
  de esta. `POST /businesses/{businessId}/reviews` (la única forma de que
  exista una fila en `resenas`) también es de la Épica 6 — así que
  `resenas.repository.js#obtenerAgregado` (que sí se implementó ya, contra
  la tabla real, filtrando `estado_moderacion = 'aprobada'`) hoy siempre
  da `{ promedio: null, total: 0 }` porque no hay filas que puedan
  cumplir ese filtro todavía (ni siquiera existe cómo crear una reseña
  aprobada sin la Épica 9 de moderación). No es un valor fijo ni un mock
  — es el resultado correcto de agregar sobre una tabla vacía; cuando la
  Épica 6 exista, este mismo código empieza a devolver datos reales sin
  tocarse.
- Épica 5: `POST /events` (RF-013/023) ya estaba completo en
  `openapi.yaml` desde antes de esta épica (`EventInput` con el enum
  `type` calcado 1:1 de `tipo_evento`) pero no tenía ninguna
  implementación en `src/`. Reglas de validación que valen la pena dejar
  explícitas: un `businessId` **mal formado** (`"abc123"`) se rechaza con
  422 en el schema de Zod (`.uuid()`), antes de tocar la base de datos; un
  `businessId` con **forma de UUID válida pero que no existe** SÍ se
  acepta (queda `negocio_id = null`) — es analítica de mejor esfuerzo,
  `202 Accepted` ya es la semántica de "aceptado para procesar", y fallar
  duro solo porque el negocio se borró entre que el cliente cargó la
  página y disparó el evento no aporta nada. Son dos capas distintas a
  propósito, no una inconsistencia con `validateUuidParam` (que trata un
  UUID mal formado en un parámetro de _ruta_ como 404): acá `businessId`
  es un campo del _body_, y la convención establecida en todo el proyecto
  para un campo de body que no pasa el schema es 422, no 404.
- Épica 5: `eventos` (tabla "de alto volumen" por diseño, según su propio
  comentario en `schema.sql`) no tenía columna `ip_origen` — a diferencia
  de `reportes_negocio`, que ya la tiene desde la Épica 2 — así que no
  había forma de limitar abuso de `POST /events` en anónimos (nada de
  limitador en memoria, mismo principio que RF-025: no sobrevive
  reinicios ni funciona igual con más de una instancia). Se agregó vía
  migración (`eventos-ip-origen`), junto con dos índices parciales
  (`usuario_id`/`ip_origen`, cada uno solo sobre las filas donde esa
  columna no es null) — sin `schema.sql` cambiado, porque ese archivo
  sigue siendo la migración inicial congelada, no el estado actual (mismo
  criterio que `reportes_negocio`/`codigos_recuperacion`, que tampoco
  están ahí). El límite (60 eventos por origen por minuto) es
  deliberadamente mucho más generoso que el de RF-025 (3 cada 10
  minutos): un reporte de negocio desactualizado es una acción deliberada
  y rara; un evento de analítica es tráfico normal — una sola sesión de
  navegación genera fácilmente decenas (búsquedas, vistas, clics). Cifra
  propia, no citada de ningún documento.
- Épica 5: `metadata` (JSONB, `additionalProperties: true` en el
  contrato) es un campo libre que puede venir de un cliente anónimo — sin
  tope de tamaño es un vector fácil para llenar `eventos` de basura
  (regla de seguridad #1). Se agregó un límite de 2 KB serializado
  (`EVENT_METADATA_MAX_BYTES`), también una cifra propia.
- Épica 6 (reseñas y reportes, RF-015/016): **reportar fotos queda fuera
  de esta épica**, aunque la prosa de la sección 6 diga "reseña o foto" —
  decisión explícita, no un olvido. `openapi.yaml` nunca tuvo una ruta de
  reporte de fotos, y `fotos` no tiene columna `estado_moderacion` (a
  diferencia de `resenas`), así que haría falta una migración +
  tabla `reportes_foto` + ruta nueva, todo simétrico a lo de reseñas.
  Queda como pendiente documentado para cuando se aborde la Épica 9
  (administración y moderación) — es ahí donde de todos modos hay que
  construir el flujo de moderación completo, tiene más sentido resolver
  ambos (reseñas y fotos) juntos en ese momento que separarlos.
- Épica 6: la tabla `resenas` no tiene ninguna relación declarada entre
  `usuario_id` y el dueño del negocio — nada impide que un vendedor
  reseñe (e infle la calificación de) su propio negocio. Un `CHECK` de
  Postgres no puede comparar contra otra tabla (haría falta un trigger,
  algo que este proyecto no usa en ningún lado todavía), así que se
  verifica en `resenas.service.js#crear` con el mismo criterio que el
  resto de las reglas de autorización del proyecto: chequeo de
  aplicación, no de base de datos.
- Épica 6: defensa en dos capas contra RF-016 (reportar en masa la misma
  reseña para tumbarla a "pending" repetidamente) — decidido junto con el
  usuario antes de implementar, no solo, ver la conversación de
  planeación:
  1. `UNIQUE(resena_id, usuario_id)` en la tabla nueva `reportes_resena`
     (migración `resenas-reportes`) — un segundo reporte del mismo
     usuario sobre la misma reseña da 409, no la vuelve a tumbar.
  2. Límite genérico de `REVIEW_REPORT_RATE_LIMIT_MAX` (3 cada 10
     minutos, mismo valor que RF-025) por usuario, sin importar sobre
     qué reseña — cubre una cuenta reportando muchas reseñas distintas
     rápido, caso que el UNIQUE de arriba no alcanza.
     A diferencia de `reportes_negocio` (RF-025, público/anónimo),
     `POST /reviews/{reviewId}/report` siempre requiere autenticación (hereda
     el auth global del contrato, sin `security: []`) — por eso
     `reportes_resena.usuario_id` es `NOT NULL` y no hace falta columna
     `ip_origen`.
- Épica 6: un reporte exitoso mueve la reseña a
  `estado_moderacion = 'pendiente'` de inmediato (decisión confirmada
  explícitamente antes de implementar: un solo reporte, sin umbral,
  saca la reseña de `GET .../reviews` hasta que la Épica 9 la revise) —
  tal como lo pedía la prosa original de esta sección, sin condicionarlo
  al estado anterior de la reseña.
- Épica 6: `GET /businesses/{businessId}/reviews` reusa exactamente el
  patrón de paginación keyset de la Épica 4/5 (`fecha_creacion::text` en
  vez de un JS `Date`, para no reintroducir la pérdida de precisión de
  microsegundos que ya se encontró y corrigió ahí) — se replicó desde el
  principio en vez de volver a descubrir el mismo bug.
- Épica 6: faltaban las respuestas de error en las 4 rutas de reseñas en
  `openapi.yaml`, y el `409` de "reseña duplicada" estaba con una
  descripción suelta en vez de `$ref` a un componente reusable — se
  agregó `components/responses/Conflict` (mismo patrón que
  `ValidationError`/`Forbidden`/etc.) y se usa también para el 409 de
  reporte duplicado.
- Épica 7 (favoritos, RF-017): idempotente en los dos sentidos, sin
  409/404 por "ya estaba así" — decisión respaldada en el propio
  contrato, no inventada: `POST /businesses/{id}/favorite` ya estaba
  declarado con `204` sin body (no `201` con el favorito devuelto y un
  409 para el duplicado, como sí se hizo con reseñas), señal de que se
  diseñó como "asegurar que esté marcado", no como creación de un
  recurso. `marcar()` usa `ON CONFLICT (usuario_id, negocio_id) DO NOTHING`;
  `desmarcar()` es un `DELETE` normal (sin filas afectadas ya es un
  no-op silencioso, no hace falta `ON CONFLICT` ahí). La PK
  compuesta de `favoritos` (sin columna `id` propia) ya impedía
  duplicados a nivel de base de datos — no hizo falta migración.
  `GET /users/me/favorites` no filtra por `estado` del negocio (un
  negocio favorito que luego cierra sigue apareciendo) — no estaba
  pedido y agregarlo hubiera sido sobre-diseñar la épica más simple del
  backlog, tal como pide la sección 6.
- Épica 8: la verificación de consentimiento en `login()`/`refresh()`
  (RF-018) deja una ventana de gracia deliberada, no accidental: una
  cuenta recién registrada sigue operando con el primer par de tokens que
  `register()` ya le entregó (sin cambios ahí) hasta que ese access token
  expire — **15 minutos**, el TTL fijo de `JWT_ACCESS_TOKEN_TTL`. El
  candado se siente recién en el siguiente `login()` o `refresh()`, no
  antes, y no hay manera de extender esa ventana refrescando: `refresh()`
  aplica el mismo chequeo antes de emitir el nuevo par, así que un intento
  de refrescar sin consentimiento completo se rechaza igual que un
  `login()`. La ventana real es los 15 minutos del access token inicial,
  no los 30 días de vida del refresh token.
- Épica 8: `tipo_consentimiento = 'registro_asistido'` (consentimiento
  otorgado por un tercero en campo, sin que el titular tenga token
  todavía) queda sin implementar en esta épica — `POST /consents` deja el
  camino abierto en la ruta (`optionalAuthenticate`, un `req.user = null`
  no rompe el middleware) pero por ahora responde 401 cuando no hay token,
  sin la lógica de negocio real. Agrupado como pendiente junto con
  `POST /auth/assisted-registration` (huérfano de contrato encontrado al
  planear esta épica — crea un negocio y su consentimiento asistido en un
  solo paso, pero no está asignado a ninguna épica de la sección 6) para
  cuando se aborde la Épica 2: en el fondo son la misma pieza — alguien
  más registrando en nombre de un vendedor que todavía no tiene cuenta.
- Épica 8: `tryAuthenticate` (middleware nuevo) es una función **separada**
  de `optionalAuthenticate` (ya usada por RF-025 y `POST /events`), no una
  modificación de esa — sus criterios son opuestos a propósito.
  `optionalAuthenticate` rechaza con 401 un token presente pero
  inválido/expirado ("un token roto no debe degradarse en silencio a
  anónimo"); `tryAuthenticate` (RF-018, `POST /consents`) nunca rechaza
  desde el middleware — cualquier falla (sin header, formato inválido,
  firma inválida, expirado) deja `req.user = null` y el handler decide.
  Cambiar el comportamiento de la función existente habría afectado a
  quien ya depende de ella; se agregó una nueva en su lugar.
- Épica 8: `ConsentInput` **no lleva un campo `userId`** — el
  consentimiento siempre se asocia a `req.user.id` cuando hay usuario
  autenticado, sin ninguna forma de otorgarlo a nombre de otro
  `usuario_id` todavía. Se consideró agregarlo (para el chequeo "si no
  coincide, 403" de autorización a nivel de objeto) pero se descartó a
  propósito: un campo que permite pedir consentimiento por otra persona,
  con solo un chequeo de igualdad y sin la lógica que decida quién puede
  hacerlo y con qué evidencia, es abrir superficie sin sostenerla — esa
  lógica es justo lo que le corresponde resolver al registro asistido
  (ver el punto anterior), no a esta épica.
- Épica 8: al correr la suite completa (no solo los archivos que parecían
  afectados) apareció una quinta prueba con el mismo problema que las 4
  ya anticipadas — `passwordReset.test.js` ("cambia la contraseña con un
  token válido...") también hace un `login()` exitoso después de
  registrar, y se había quedado fuera de la revisión inicial porque solo
  se inspeccionó `auth.test.js`. Se corrigió con el mismo patrón —
  otorgar los dos consentimientos obligatorios antes de la aserción que
  espera 200 — y queda anotado como recordatorio: "qué pruebas llaman a
  X" hay que verificarlo corriendo la suite completa, no con una
  búsqueda manual limitada a un solo archivo.

## 11. Mejoras futuras propuestas

Ideas fuera del alcance original de la especificación (Documentos 05-15),
registradas aquí para no perderlas — **no son código a implementar ahora**,
ninguna está asignada a una épica de la sección 6. Antes de convertir
cualquiera de estas en trabajo real, hay que decidir en qué épica entra (o
si amerita una nueva) y pasar por el mismo proceso de verificación contra
el código real que ya se sigue en este archivo.

- **Confirmación de disponibilidad en tiempo real**: un consumidor
  autenticado podría solicitar que un negocio confirme que está vendiendo
  en este momento — útil cuando el negocio está lejos y el consumidor no
  quiere caminar hasta allá solo para encontrarlo cerrado (el "abierto
  ahora" de la Épica 4 solo refleja el horario declarado, no si el
  vendedor realmente salió hoy). El vendedor recibiría un aviso push real
  al celular — que le suene o aparezca en la pantalla del dispositivo
  aunque no tenga la app abierta en ese momento, no un simple aviso
  dentro de la app que solo se ve si la abre — pidiendo confirmar; si
  confirma, el perfil/mapa del negocio mostraría "confirmado vendiendo
  ahora" con marca de tiempo; si no responde dentro de una ventana corta
  (a definir), la solicitud expira sin cambiar ningún estado — nunca se
  asume disponibilidad ni indisponibilidad por default. Requiere, como
  mínimo:
  1. Integrar Firebase Cloud Messaging (o equivalente) para el envío real
     al dispositivo — no hay ningún proveedor de push conectado hoy, el
     mismo tipo de gap que ya existe para correo (RF-003, Épica 1) y SMS
     (registro asistido, Épica 2): mientras no se elija e integre un
     proveedor, no hay forma de que esto funcione de punta a punta.
  2. El vendedor debe haber otorgado `tipo_consentimiento = 'notificaciones'`
     — el valor ya existe en el enum (Documento 07, sección 5 de este
     archivo) pero nunca se implementó ningún flujo que lo pida ni que lo
     use para condicionar el envío de algo.
  3. Limitar cuántas solicitudes puede recibir un mismo negocio en una
     ventana de tiempo, para que un consumidor (o varios) no puedan
     convertir esto en spam de notificaciones hacia el vendedor — mismo
     principio que ya se aplica en RF-025 y RF-016 (límite de tasa por
     origen, respaldado en base de datos, no en memoria).

  **Implementado (2026-09-09)**: `POST /businesses/{businessId}/availability-requests`
  (crear), `GET /availability-requests/{requestId}` (consultar, solo el
  consumidor que preguntó o el dueño del negocio), `PATCH
  .../{requestId}/respond` (`decision: confirmed|declined` — se agregó
  "declinar" a la idea original: sin eso, un consumidor no distinguía "el
  vendedor ya vio el aviso y no está vendiendo" de "todavía no responde",
  hasta que expirara la ventana completa) y `POST /users/me/device-tokens`
  (registrar el token FCM del dispositivo actual — no existía ningún
  concepto de token de dispositivo, tabla `tokens_dispositivo` nueva,
  uno-a-muchos con `usuarios`, mismo criterio que `tokens_refresco`).
  Decisiones que vale la pena dejar explícitas:
  - **Sin exclusividad, a propósito**: cualquier número de solicitudes
    pendientes simultáneas sobre el mismo negocio es válido — bloquear
    con 409 al segundo consumidor que pregunta por un negocio popular en
    hora pico perjudicaría el caso de mayor valor de esta función. Doble
    capa de rate limit (por `negocio_id` y por `usuario_id` solicitante,
    `AVAILABILITY_REQUEST_RATE_LIMIT_PER_*` en `constants.js`) es la única
    protección contra spam hacia el vendedor.
  - `solicitudes_disponibilidad.decision`/`respondida_en` son las únicas
    columnas que algo escribe — "expired" nunca se guarda, se calcula al
    leer comparando `expira_en` contra el reloj (expiración perezosa, sin
    cron, mismo patrón que `codigos_recuperacion` del registro asistido).
  - `src/config/firebaseClient.js` exporta `null` sin las tres variables
    `FIREBASE_*` configuradas (opcionales en dev/staging, obligatorias en
    production, mismo patrón que `SENTRY_DSN`) — `push.service.js` lo
    trata como "no hay proveedor conectado todavía" y no envía nada, sin
    romper la solicitud (best-effort, igual que la limpieza de storage).
  - **Limitación real, no oculta**: sin frontend, no hay forma de que un
    dispositivo real registre un token FCM ni de probar la entrega
    end-to-end del push. Las pruebas (`tests/unit/push.service.test.js`,
    `tests/integration/availabilityRequests.test.js`) mockean
    `firebaseClient.js` y verifican que el backend invoca el SDK de
    Firebase Admin con el payload correcto — nunca que un celular sonó de
    verdad. Eso queda pendiente hasta que exista un cliente real.

- **Cobro por visibilidad post-piloto**: idea de negocio, no de código —
  documentada aquí solamente, nada de esto se implementa todavía. Sigue
  condicionada a la disciplina de "cero monetización durante el piloto"
  del Documento 03 — una vez el piloto muestre evidencia suficiente (KPI
  de contactos generados, Documento 03 sección 8.10; sigue siendo una
  condición que se cumple, no una fecha fija en el calendario), el
  negocio podría pagar por visibilidad destacada por un período elegido
  (semana, 15 días, mes, trimestre, año), con promociones de atracción
  como prueba gratis por tiempo limitado o para los primeros N registros.
  Requeriría, cuando llegue ese momento:
  1. Una tabla nueva (ej. `planes_negocio`) con `negocio_id`, tipo de
     plan, `origen` (`'pagado' | 'promocion' | 'prueba_gratis'`),
     `fecha_inicio`, `fecha_fin`, y una referencia de pago — el id que
     devuelve la pasarela, nunca datos de tarjeta ni de cuenta bancaria:
     eso lo maneja completamente la pasarela, misma disciplina que ya
     aplica el resto del proyecto con contraseñas (nunca se guarda el
     secreto, solo una referencia/hash a lo que lo verifica).
  2. El vencimiento se calcula al leer comparando `fecha_fin` contra el
     reloj — mismo patrón de expiración perezosa ya usado en el resto de
     este archivo, sin introducir un cron nuevo.
  3. Pasarela sugerida: PSE, por permitir pago desde billeteras digitales
     (Nequi, Daviplata) sin requerir tarjeta de crédito — accesible para
     el perfil de vendedor informal que es el público de la app.
  No asignada a ninguna épica todavía.

## 12. Frontend — stack y arquitectura

- Framework: **Next.js (React)**, App Router. Se elige sobre SvelteKit por
  ecosistema/documentación más profundos, a costa de un poco más de peso en
  celulares de gama baja — mitigado con code-splitting agresivo y las
  optimizaciones de imagen nativas de Next.js (críticas aquí: casi todo el
  contenido es fotografía de comida).
- El frontend consume **exclusivamente** `openapi.yaml` — nunca acceso
  directo a la base de datos ni al almacenamiento S3-compatible desde el
  cliente.
- **Renderizado del perfil de negocio en servidor (SSR/ISR)**, no
  client-side puro: cuando un vendedor comparte su perfil por WhatsApp
  (canal principal según Documento 08, personas Don Alirio/Marcela), el link
  debe generar una vista previa enriquecida (Open Graph: foto, nombre,
  calificación) al pegarse en el chat. Esto es imposible con un SPA
  100% client-side. El resto de la app (mapa, búsqueda, perfil de usuario)
  puede ser client-side normal detrás de autenticación.
- **PWA instalable**: manifest + service worker desde la Épica F0, no como
  capa posterior. Justificación: el backend ya implementa push vía Firebase
  Cloud Messaging para la confirmación de disponibilidad en tiempo real
  (`POST /users/me/device-tokens`, ver sección 6 de este archivo) — sin PWA
  instalable con Web Push, esa funcionalidad de backend no tiene consumidor
  del lado del cliente.
- Sin app nativa obligatoria (coherente con la sección 2 de `CLAUDE.md`).

## 13. Seguridad del lado del cliente

1. El access token **nunca se guarda en `localStorage` ni `sessionStorage`**
   (riesgo de robo vía XSS) — se mantiene solo en memoria (estado de la
   aplicación). Al recargar la página, se intenta un refresco silencioso
   contra `POST /auth/refresh` antes de mostrar cualquier pantalla que
   requiera sesión.
2. El refresh token se maneja según lo que exponga el backend en la Épica 1
   — si el backend ya lo devuelve solo en el cuerpo de la respuesta (no en
   cookie), el cliente lo guarda en un lugar no accesible a scripts de
   terceros (nunca en una variable global expuesta); evaluar con Code si
   conviene migrar `POST /auth/refresh` a un patrón de cookie `httpOnly` +
   `Secure` + `SameSite=Strict` antes de producción — no bloquea el MVP.
3. Content-Security-Policy estricta desde el primer despliegue (sin
   `unsafe-inline` en scripts), para reducir superficie de XSS.
4. Ninguna coordenada de consumidor se persiste en el cliente más allá de la
   sesión activa, coherente con la sección 4 de `CLAUDE.md` (Ley 1581).
5. Todo dato de usuario (nombre de negocio, reseña) se renderiza siempre
   escapado — Next.js lo hace por defecto en JSX; nunca usar
   `dangerouslySetInnerHTML` con texto de usuario.

## 14. Autenticación — passkeys como opción adicional

El login con correo/contraseña de la Épica 1 del backend **no cambia y
sigue siendo el método por defecto** (indispensable para Don Alirio, baja
familiaridad digital, Documento 08 sección 5.1). Se agrega WebAuthn/passkeys
como **opción adicional** en la pantalla de login y en configuración de
cuenta, nunca como reemplazo obligatorio:

- Registrar una passkey requiere sesión ya iniciada (se ofrece desde
  "Perfil > Configuración", no durante el primer registro, para no añadir
  fricción al onboarding que el Documento 08 pide mantener corto).
- El botón de login ofrece "Entrar con correo" (siempre visible, primero) y
  "Entrar con passkey" (secundario) cuando el dispositivo/navegador lo
  soporta — detectar soporte con `PublicKeyCredential` antes de mostrarlo,
  nunca asumirlo.
- Esto requiere agregar al backend (coordinar con Code al llegar a esta
  épica): tabla de credenciales WebAuthn por usuario y dos rutas nuevas no
  presentes hoy en `openapi.yaml` (`POST /auth/webauthn/register`,
  `POST /auth/webauthn/login`) — agregarlas ahí junto con su definición
  OpenAPI, mismo criterio que se usó para RF-025 en la Épica 2 del backend.

## 15. Fuera de alcance — explícito, no un olvido

- **Sin pagos dentro de la aplicación.** RUTEANDO es intermediario de
  información (sección 4 de `CLAUDE.md`); ningún flujo de frontend debe
  simular checkout, carrito o cobro. La compra ocurre en el punto de venta
  físico, fuera de la app.
- La idea de **"cobro por visibilidad post-piloto"** (documentada en
  `CLAUDE.md`, ver historial de PR #14) es un modelo de negocio a futuro,
  no una pantalla a construir ahora — no crear ninguna UI de precios,
  planes ni facturación mientras dure el piloto.

## 16. Instrumentación de eventos (transversal a todas las épicas)

La tabla `eventos` y el panel de métricas del administrador (Épica 9 del
backend) ya existen, pero dependen de que el frontend efectivamente dispare
`POST /events` en cada interacción. Esto no es una épica aparte: cada épica
de frontend que toque una de estas pantallas debe incluir su evento
correspondiente antes de darse por cerrada:

| `tipo_evento` | Se dispara en |
|---|---|
| `busqueda` | Al ejecutar una búsqueda por texto o categoría (Épica F2, hoy en `/buscar` — ver sección 18) |
| `vista_negocio` | Al abrir el perfil completo de un negocio (Épica F4) |
| `vista_producto` | Al expandir el detalle de un producto en el menú (Épica F4) |
| `clic_contacto` | Al tocar el botón de WhatsApp en el perfil (Épica F4) |
| `favorito_agregado` | Al marcar un negocio como favorito (Épica F8) |
| `resena_creada` | Al publicar una reseña (Épica F7) |
| `registro_negocio` | Al completar el registro de un negocio (Épica F5) |

`logSearchEvent` (`home-screen.tsx`) no se movió ni se duplicó al mudar
esa pantalla a `/buscar` (PR #41, sección 18) — sigue siendo el mismo
componente, solo cambió la ruta que lo monta.

## 17. Patrón de interacción — mínimo scroll, expandir en el mismo lugar

Decisión de diseño explícita (extiende Documento 08, sección 5.4): antes de
crear una pantalla nueva o una navegación adicional para mostrar más
información, preferir que el contenido se expanda en el mismo lugar
(acordeón, "bottom sheet", tarjeta que crece) — el Documento 08 ya aplica
esto en la tarjeta resumen del mapa (sección 5.4.2); se extiende a:

- **Menú del negocio**: cada plato se expande al tocarlo (foto grande,
  descripción completa) sin navegar a otra pantalla.
- **Buscar** (antes "Inicio" — la pantalla no cambió, solo su ruta y su
  lugar en la barra inferior, ver sección 18): una tarjeta de negocio se
  despliega in-place para mostrar horario/reseñas rápidas, en vez de abrir
  el perfil completo salvo que el usuario pida "ver perfil completo".
- **Reseña rápida y reporte**: un "bottom sheet" que sube desde abajo, no
  una pantalla nueva.
- Este patrón no reemplaza la navegación de primer nivel ya fijada en la
  sección 5.3.1 del Documento 08 (barra inferior de cuatro destinos) — aplica
  dentro de cada pantalla, no entre ellas.

## 18. Secuencia de épicas de frontend

Mismo criterio que el backend (sección 6 de `CLAUDE.md`): una rama
`feature/<nombre>` por épica, no avanzar sin pruebas pasando, revisar antes
de la siguiente.

- **Épica F0 — Preparación**: proyecto Next.js + PWA (manifest, service
  worker), tokens de diseño del Documento 08 sección 5.5 como variables
  CSS/config de Tailwind (colores, tipografía Plus Jakarta Sans/Inter,
  radios, sombras), Phosphor Icons, cliente HTTP tipado desde
  `openapi.yaml`.
- **Épica F1 — Autenticación**: login/registro contra la Épica 1 del
  backend, manejo de tokens en memoria (sección 13), passkeys opcionales
  (sección 14).
- **Épica F2 — Inicio y búsqueda** (RF-009 a RF-011): pantalla de inicio sin
  scroll infinito, categorías rápidas, lista corta "cerca de ti", barra de
  búsqueda, skeleton screens mientras carga. **Ruta actual: `/buscar`, no
  `/`** — ver "El mapa pasa a ser la pantalla principal" más abajo.
- **Épica F3 — Mapa**: pines agrupados, tarjeta resumen expandible in-place,
  filtros combinables (distancia, precio, abierto ahora). **Ruta actual:
  `/`, no `/mapa`** — ver "El mapa pasa a ser la pantalla principal" más
  abajo.
- **Épica F4 — Perfil de negocio y menú** (RF-006 a RF-008, RF-012 a
  RF-014): foto a color completo, estado "abierto ahora", botones WhatsApp
  y "cómo llegar" fijos, menú con productos expandibles, reseñas.
- **Épica F5 — Registro de negocio** (RF-004, RF-005, RF-024, RF-025): flujo
  paso a paso con progreso visible ("Paso 2 de 5"), incluye registro
  asistido (ya construido en backend, PR #11).
- **Épica F6 — Perfil de usuario**: pestañas de favoritos, reseñas y
  configuración (incluye gestión de consentimientos RF-018 y, si aplica,
  passkeys).
- **Épica F7 — Reseñas y reportes** (RF-015, RF-016): formulario de reseña,
  reportar contenido.
- **Épica F8 — Favoritos** (RF-017): la más simple, no sobre-diseñarla.
- **Épica F9 — Panel administrador**: superficie web separada (no dentro de
  la PWA de consumidor/vendedor), para el Equipo administrador (Documento 08,
  persona secundaria) — aprobar negocios, moderar reseñas, ver métricas.
- **Épica F10 — PWA y Web Push**: registro de token de dispositivo contra
  `POST /users/me/device-tokens`, manejo de la notificación de confirmación
  de disponibilidad en tiempo real (PR #13) en el navegador.

### El mapa pasa a ser la pantalla principal (PR #41, `feature/mapa-pantalla-principal`)

Cambio de ruteo, sin RF asociado — decisión de producto tomada después de
que las Épicas F2-F9 ya estuvieran construidas y documentadas arriba con
las rutas originales (`/` = Inicio/búsqueda, `/mapa` = mapa). Esas
descripciones de épica no se reescribieron (siguen siendo el registro de
qué se construyó y por qué), pero las rutas que citan ya no son las
vigentes:

- `/` ahora renderiza `MapScreen` (lo que antes era la Épica F3).
- La pantalla de la Épica F2 (categorías rápidas, "cerca de ti", barra de
  búsqueda — `HomeScreen`, sin cambios internos) se mudó a `/buscar`.
- `/mapa` queda como un `redirect("/")` (`client/src/app/mapa/page.tsx`),
  no se borró, por si algún link/marcador externo todavía apunta ahí.
- `BottomNavBar` (sección 28) cambia su destino "Inicio" por "Buscar"
  (`/buscar`, ícono `MagnifyingGlass`) y "Mapa" pasa a apuntar a `/` en
  vez de `/mapa` — el resto de la barra (Favoritos, Perfil) no cambia.

Ningún evento de la tabla de la sección 16 cambió de disparador, solo de
ruta — ver la nota bajo esa tabla.

## 19. Gaps conocidos para el frontend

- Las rutas WebAuthn (sección 14) no existen todavía en `openapi.yaml` —
  agregarlas junto con la Épica F1, no antes.
- El patrón exacto de refresco de sesión (memoria + silent refresh vs.
  cookie `httpOnly`) se decide en la Épica F1 con Code, evaluando el
  esfuerzo de tocar el backend ya cerrado (Épica 1) contra el beneficio de
  seguridad.
- El Documento 08 no incluye wireframes del formulario de reseña ni del
  panel administrativo (lo advierte explícitamente en su sección 5.4,
  nota final) — estas dos pantallas se diseñan durante las Épicas F7 y F9
  siguiendo los mismos principios ya fijados en las secciones 5.5 y 17 de
  este archivo, sin esperar un wireframe adicional.
- **Hallazgo (2026-09-10)**: `FloatingActionStack` se construyó durante la
  Épica F4 (perfil de negocio) pero nunca quedó documentado acá — la
  Épica F3 (mapa), que se cerró antes, no lo usaba y sus propios controles
  (filtros, ubicación) se quedaron como una barra fija y sin acción de
  "recentrar". Corregido en `fix/mapa-floating-action-stack`: el mapa
  ahora usa el mismo componente (ver sección 20 de este archivo) y ese
  retrofit generalizó `FloatingActionStack` de "WhatsApp/Cómo llegar"
  (hardcodeado) a dos acciones configurables — su forma final, no la
  original de F4, es la que documenta la sección 20.
- **Hallazgo (2026-09-11, Épica F5)**: la prosa de la sección 18 describe
  el registro asistido como "una opción del flujo", lo que sugería un
  selector libre entre "registro propio" y "registro asistido". Leyendo
  el backend real (`businesses.routes.js`, `auth.routes.js`) resultó que
  no hay tal elección: `POST /businesses` exige
  `requireRole('vendor')` y `POST /auth/assisted-registration` exige
  `requireRole('administrator')` — son mutuamente excluyentes por rol, no
  una preferencia del usuario. El asistente de registro
  (`business-registration-wizard.tsx`) por eso no tiene pantalla de
  elección: rama directo según `user.role` (vendor → asistente de 3
  pasos; administrator → formulario de registro asistido; consumer →
  pantalla explicando que necesita una cuenta de vendedor o que un
  administrador lo registre por él). Verificado de punta a punta contra
  el backend real con los tres roles.
- **Hallazgo (2026-09-11, Épica F6)**: no existía ninguna ruta para
  "mis reseñas" — solo `GET /businesses/{businessId}/reviews` (por
  negocio, público, solo `approved`) y `POST`/`DELETE` de una reseña
  puntual. Se agregó `GET /users/me/reviews` (junto con su definición
  OpenAPI y el schema `UserReview`, que suma `businessName` a `Review`
  para no obligar al cliente a resolverlo aparte por cada fila), mismo
  criterio que RF-025 en la Épica 2: a diferencia de la lista pública,
  no filtra por `moderationStatus` — el autor ve sus propias reseñas
  pendientes o rechazadas también, igual que ya puede borrar cualquiera
  de ellas sin ese filtro (`DELETE /reviews/{reviewId}`).
- Épica F6: verificado que `POST /auth/webauthn/register` y
  `POST /auth/webauthn/login` (sección 14) siguen sin existir en
  `openapi.yaml` — la sección de passkeys en Configuración se omitió
  por completo, tal como pide la sección 19 más abajo, en vez de
  simularla o dejarla a medias.
- Épica F6: sin edición de perfil (`PATCH`/`DELETE /users/me` ya
  existen en `openapi.yaml` pero no se usan) ni botón de revocar
  consentimientos (no hay endpoint para eso — `consentimientos` es
  append-only por diseño, CLAUDE.md sección 6 Épica 6/8) — ninguna de
  las dos se pidió para esta épica, agregarlas habría sido
  sobre-construir la pantalla.

## 20. Componente FloatingActionStack

`client/src/components/ui/floating-action-stack.tsx` — reemplaza, para
cualquier pantalla que lo necesite, el patrón de "dos botones horizontales
fijos" que describía originalmente el Documento 08 (ej. WhatsApp/Cómo
llegar en el perfil de negocio, sección 5.4.3). Esta sección es la única
fuente de verdad de su especificación — si el componente cambia, actualizar
acá también, no dejar que el código y este archivo diverjan.

**Props** (`primary: FloatingAction | null`, `secondary?: FloatingAction | null`):

```ts
interface FloatingAction {
  icon: ReactNode;
  label: string;      // aria-label, también el nombre accesible para pruebas
  href?: string;       // si viene, la acción es un enlace externo (target="_blank")
  onClick?: () => void; // si viene, la acción es un botón local (recentrar, abrir un panel, analítica)
}
```

- `primary` es el círculo grande (`h-16 w-16`, `bg-terracota text-white`,
  `shadow-xl`) — la acción más cercana a la esquina de la pantalla.
- `secondary` es el círculo más chico (`h-12 w-12`, `border border-border
  bg-surface text-terracota`, `shadow-lg`), apilado **encima** del
  principal (mismo orden en el DOM: secundaria primero, principal
  después, dentro de un `flex flex-col`).
- El stack completo es `fixed bottom-6 right-6 z-40`, con `gap-3` entre
  los dos círculos. Si ambas props son `null`, el componente no renderiza
  nada (sin dejar un contenedor vacío).
- Cada acción decide su propio elemento: con `href` es un `<a>` (abre en
  pestaña nueva, `rel="noopener noreferrer"`); sin `href` es un
  `<button type="button">`. `onClick` funciona en los dos casos (en el
  `<a>` no bloquea la navegación — sirve para analítica best-effort antes
  de que el enlace abra).
- Si falta el dato que una acción necesita (ej. un negocio sin teléfono,
  o sin ubicación registrada), quien llama pasa `null` en esa posición —
  el botón correspondiente desaparece por completo, nunca queda un botón
  que enlaza a nada.

**Usos actuales:**

| Pantalla | `primary` (círculo grande) | `secondary` (círculo chico) |
|---|---|---|
| Perfil de negocio (Épica F4, `business-profile-screen.tsx`) | WhatsApp — `WhatsappLogo`, `href` a `wa.me` con mensaje prellenado, `onClick` dispara `clic_contacto` | Cómo llegar — `NavigationArrow`, `href` a Google Maps con las coordenadas de la ubicación |
| Mapa (Épica F3, retrofit `fix/mapa-floating-action-stack`, `map-screen.tsx`) | Mi ubicación — `Crosshair`, `onClick` recentra el mapa sobre la posición del usuario (o reintenta el permiso de geolocalización si todavía no fue concedido) | Filtros — `SlidersHorizontal`, `onClick` abre/cierra el panel de distancia/precio/abierto-ahora como bottom sheet (sección 17) |

Cualquier pantalla nueva que necesite dos acciones flotantes (una
principal, una secundaria opcional) debe reutilizar este componente en
vez de construir un stack de círculos aparte — es exactamente el motivo
por el que se generalizó en el retrofit del mapa.

## 21. Verificación de teléfono de vendedores (SMS OTP)

Fuera del alcance original de los Documentos 05-15 (como el registro
asistido o la confirmación de disponibilidad en tiempo real) — agregada
después, en su propia rama (`feature/verificacion-telefono-vendedor`),
para reducir vendedores fantasma/cuentas falsas durante el piloto.

**Qué hace**: un negocio no aparece en `GET /businesses` ni
`GET /businesses/nearby` (mapa/búsqueda pública) hasta que su dueño
confirme, por SMS, el mismo número de teléfono que de todas formas iba a
publicar como contacto de WhatsApp — la aprobación de un administrador
(RF-019, Épica 9) sigue siendo necesaria pero ya no es suficiente por sí
sola: hacen falta **las dos** condiciones (`status = 'active'` y
`phoneVerified = true`). `GET /businesses/{businessId}` (perfil por id
directo) no aplica este filtro — es ahí donde el propio dueño ve el
estado "pendiente de verificación" de su negocio y puede resolverlo.

**Por qué teléfono y no cédula/identidad completa, en esta etapa**:
decisión explícita, no un atajo técnico. El público objetivo (Documento
08, persona "Don Alirio") son vendedores informales sin registro
mercantil ni facturación electrónica (sección 0/1 de este archivo) — muchos
no tienen o no cargan encima una cédula digitalizable, y exigirla
convertiría el piloto en una barrera de entrada que contradice el
objetivo explícito de RNF-013 (registro completo en menos de 10
minutos) y la premisa completa del proyecto. Verificar el teléfono de
WhatsApp:
1. No agrega fricción real — es un dato que el vendedor ya iba a dar
   para que los consumidores lo contacten (RF-012 a RF-014).
2. Da una señal razonable de que la cuenta es de una persona real,
   activa, con acceso al número que publica — suficiente para el
   objetivo declarado (reducir vendedores fantasma), no un sistema de
   verificación de identidad (KYC) completo.
3. No depende de tener documentos formales que buena parte del público
   objetivo puede no tener a mano.

Si el piloto muestra evidencia de abuso que esto no cubre (números
reciclados, verificación por terceros, etc.), subir el nivel de
verificación es una decisión de producto futura, no algo que deba
resolverse de más ahora — igual que la sección 11 trata el cobro por
visibilidad.

### Modelo de datos

- `negocios.telefono_verificado` (`BOOLEAN NOT NULL DEFAULT false`,
  migración `verificacion-telefono-vendedor`) — todo negocio existente
  (solo datos sintéticos/de desarrollo a esta altura del proyecto, sin
  vendedores reales todavía) queda sin verificar; sin backfill a `true`,
  sería fingir una verificación que nunca ocurrió.
- `codigos_verificacion_telefono` (nueva tabla) — OTP de 6 dígitos, no
  el patrón de `codigos_recuperacion` (token opaco de 256 bits): **sin
  `UNIQUE` en `codigo_hash`** (un choque entre dos códigos de 6 dígitos
  es perfectamente posible, a diferencia de un token de 256 bits) y
  **con `intentos`** (que `codigos_recuperacion` no necesita — un OTP de
  6 dígitos, 10⁶ combinaciones, sí es adivinable por fuerza bruta sin un
  tope de intentos fallidos).
- `usuarios.ip_origen` (`INET`, nullable) — respaldo interno, nunca
  expuesto en la API ni visible para el propio usuario (`user.mapper.js`
  no lo mapea), por si alguna vez hace falta colaborar con una autoridad
  ante un reporte de actividad ilegal. Solo se registra en
  `POST /auth/register` (`auth.service.js`, vía `req.ip` —
  `app.set('trust proxy', 1)` ya estaba configurado desde RF-025). El
  registro asistido (`registroAsistido.repository.js`, INSERT propio,
  no pasa por `usuarios.repository.js#crear`) lo deja `NULL` a propósito
  — la IP de esa petición es la del administrador, no la del vendedor.

### Envío de SMS — sin proveedor real todavía (piloto)

`src/services/smsSender.service.js` es la única pieza que sabe "enviar"
un código — mismo patrón que el correo de RF-003 y el push de
disponibilidad en tiempo real (sección 10/11 de este archivo): sin
proveedor de SMS elegido ni activado (piloto, sin costo de por medio
todavía), el código se registra en el log estructurado (pino) con un
`TODO` explícito. `verificacionTelefono.service.js` (que genera el
código, lo hashea y lo guarda) llama a esta función sin saber que no hay
envío real detrás — cuando se elija un proveedor (Twilio, Labsmobile,
cualquiera con cobertura en Colombia y cobro por SMS enviado, no plan
mensual fijo), reemplazar el cuerpo de esa función es el único cambio
necesario.

### Límites y expiración (valores propios, no citados de ningún documento)

- `PHONE_VERIFICATION_CODE_TTL_MS`: 10 minutos (pedido explícito de
  producto: "~10 minutos").
- `PHONE_VERIFICATION_MAX_ATTEMPTS`: 5 intentos fallidos antes de
  invalidar el código activo (protección de fuerza bruta contra el
  espacio de 10⁶ combinaciones).
- `PHONE_VERIFICATION_RATE_LIMIT_MAX`/`_WINDOW_MINUTES`: 3 reenvíos cada
  10 minutos por negocio — mismo valor que RF-025/RF-016, aunque acá la
  ruta siempre requiere autenticación como dueño del negocio.

### Endpoints nuevos

`POST /businesses/{businessId}/phone-verification` (enviar/reenviar) y
`POST /businesses/{businessId}/phone-verification/confirm` (confirmar) —
ambos solo para el dueño del negocio. Ambos son idempotentes hacia un
negocio ya verificado: reenviar no genera un código nuevo, confirmar de
nuevo devuelve 200 sin exigir un código vigente.

### Frontend

- El paso de datos del asistente de registro (Épica F5,
  `details-step.tsx`) hace `contactPhone` obligatorio — BusinessInput lo
  sigue declarando opcional en el backend (para otros llamadores, ej.
  registro asistido), pero el asistente es hoy el único camino que tiene
  un vendedor para registrar su propio negocio, y sin teléfono no hay
  forma de completar la verificación ni, hoy, ninguna pantalla de
  "editar negocio" fuera de este flujo para agregarlo después.
- `client/src/components/business/phone-verification-panel.tsx` —
  componente compartido entre la pantalla final del asistente
  (`done-step.tsx`) y el perfil de negocio (`business-profile-screen.tsx`,
  solo visible para el dueño mientras `phoneVerified` sea `false`). Sin
  envío automático al montar (cada envío cuenta contra el límite de
  reenvíos): el primer paso siempre es un clic explícito.
- `business-profile-screen.tsx` decide si quien mira es el dueño
  comparando `profile.ownerId === user?.id` **del lado del cliente**
  (`useAuth()`, después de la hidratación) — no con un campo
  "esPropietario" resuelto en el Server Component
  (`app/negocios/[businessId]/page.tsx`): ese componente usa el cliente
  HTTP compartido durante el renderizado en servidor, que nunca lleva el
  access token (vive en una variable de módulo exclusiva del navegador,
  ver `token-store.ts`) — un campo resuelto ahí para "el dueño" daría
  siempre `false` para el dueño real. `ownerId` ya viajaba sin protección
  en `Business` desde antes de esta épica, así que compararlo en el
  cliente no expone nada nuevo. (Esta misma limitación de fondo — el
  perfil renderizado en servidor nunca ve el token del navegador — ya
  afectaba a `rejectionReason`, sin resolver; no se tocó acá por no ser
  parte de esta funcionalidad.)

### Gaps conocidos

- `scripts/seedLoadTest.js` (y su acompañante `scripts/loadtest-nearby.js`)
  **no se tocaron a propósito** (instrucción explícita: mantener esta
  funcionalidad separada del script de datos de prueba) — siembran
  negocios `activo` sin `telefono_verificado`, así que hoy quedarían
  invisibles para `/businesses/nearby` y la prueba de carga documentada
  en la sección 10 dejaría de medir un escenario real hasta que ese
  script se actualice aparte (agregar `telefono_verificado = true` al
  `INSERT` masivo, mismo ajuste que se hizo en
  `tests/integration/nearbyIndexPlan.test.js`).
- Sin panel de administrador que muestre el estado de verificación de
  teléfono en la cola de aprobación (Épica 9/F9) — no se pidió para esta
  funcionalidad; un administrador ve `phoneVerified` en la respuesta de
  `GET /businesses/{businessId}` como cualquier otro consumidor de la
  API, pero no hay una vista dedicada todavía.

## 22. Ubicación aproximada vs. dirección exacta

Fuera del alcance original de los Documentos 05-15 (sin RF asociado) —
petición directa del usuario, propia rama
(`feature/ubicacion-aproximada-negocio`).

**Qué hace**: cada ubicación de negocio (`ubicaciones`) tiene un
interruptor — "Mostrar mi dirección exacta" vs. "Mostrar solo la zona
aproximada" — que decide qué coordenada expone el mapa/búsqueda
**pública**. La coordenada real (`ubicaciones.punto`) se guarda siempre
tal cual, sin importar el interruptor — es solo una cuestión de qué se
**muestra**, nunca de qué se **guarda** ("logística interna" sigue
teniendo el dato completo). Default `false` ("zona aproximada") a
propósito, pedido explícito del usuario: protege por defecto a un
vendedor que opera desde su casa (ej. desayunos sorpresa a domicilio,
`tipo_ubicacion = 'desde_casa'`) sin que tenga que saber que la opción
existe. El vendedor lo cambia cuando quiera desde el perfil de su
negocio (`business-profile-screen.tsx`, solo visible para el dueño), sin
tener que volver a mandar type/latitude/longitude.

### Cómo se aproxima

`business.mapper.js#aproximarCoordenada` — redondeo determinístico a 3
decimales (~111m en el ecuador, del orden de una manzana/conjunto): el
mismo negocio siempre aproxima al mismo punto (el pin no "salta" entre
pedidos), sin necesidad de guardar un punto aproximado aparte. Aplica a
`latitude`/`longitude` en tres lugares:
- `GET /businesses` y `GET /businesses/nearby` (`negocios.repository.js#listar/cercanos`,
  que ahora también seleccionan `mostrar_ubicacion_exacta` en el join con
  `ubicaciones`) — públicos, sin ningún concepto de "quien pregunta": la
  columna es la única señal.
- `GET /businesses/{businessId}` (`BusinessProfile.location`) y
  `GET /businesses/{businessId}/location` — ambos exponen la coordenada
  real cuando quien pregunta está autenticado **y** es el dueño
  (`toApiLocation({ requesterIsOwner })`), sin importar el interruptor;
  para cualquier otro caso, el interruptor decide. `GET .../location` no
  tenía ningún concepto de "dueño" antes de esta funcionalidad (era
  100% pública, sin `optionalAuthenticate`) — se agregó exactamente el
  mismo patrón que ya usa `GET /businesses/{businessId}` con
  `rejectionReason`.

**Importante**: `distanceMeters` (en `/businesses/nearby`) **nunca** se
aproxima — sigue siendo la distancia real, calculada contra el punto
exacto; solo se aproxima la coordenada que se muestra en el mapa. Es la
misma decisión de producto que toman apps de reparto que aproximan el
pin pero no la distancia/ETA — sin esa exactitud, la búsqueda por
cercanía pierde su utilidad real.

### Límites reconocidos, no ocultos

- El redondeo de coordenada no protege `referenceAddress` (texto libre):
  si el vendedor escribe "Torre 5, Apto 301" ahí, ese texto se muestra
  tal cual sin importar el interruptor — el backend no puede detectar ni
  redactar de forma confiable una dirección exacta dentro de texto
  libre arbitrario. Mitigado solo con una advertencia en el formulario
  del cliente (`location-step.tsx`), no con lógica de servidor.
- Alguien que consulte `distanceMeters` desde varios puntos de
  referencia distintos podría, en teoría, triangular una posición más
  precisa que la coordenada aproximada que se muestra — no se intenta
  resolver ese caso acá (aproximar también la distancia rompería la
  utilidad real de la búsqueda por cercanía, ver arriba). Mismo
  trade-off que cualquier app que aproxima un pin pero no la
  distancia/ETA.

### Modelo de datos

`ubicaciones.mostrar_ubicacion_exacta` (`BOOLEAN NOT NULL DEFAULT false`,
migración `ubicacion-aproximada`) — vive en `ubicaciones`, no en
`negocios`: es una propiedad de "cómo se expone este punto geográfico",
el mismo dominio que `tipo`/`direccion_referencia` en esa misma tabla.

### Endpoints

- `LocationInput` (`PUT /businesses/{businessId}/location`) suma
  `showExactLocation` (opcional, default `false`) — se puede elegir
  desde el primer registro (Épica F5, `location-step.tsx`).
- `PATCH /businesses/{businessId}/location/visibility` (nuevo) — solo
  el dueño, body `{ showExactLocation: boolean }`. Aparte de PUT
  .../location a propósito: cambiar esta preferencia "cuando quiera" no
  debería exigir volver a mandar type/latitude/longitude.
  `ubicaciones.repository.js#actualizarVisibilidad` actualiza solo esa
  columna de la fila `es_actual`, sin pasar por
  `reemplazarActual()` (que inserta una fila nueva — no es un
  reemplazo de ubicación, es una preferencia).

## 23. Solicitud de eliminación de cuenta (Configuración, Ley 1581)

Fuera del alcance original de los Documentos 05-15 (sin RF asociado) —
petición directa del usuario, propia rama
(`feature/solicitud-eliminacion-cuenta`). Botón "Solicitar eliminación
de mi cuenta y mis datos" en Configuración (Épica F6, ya construida en
`settings-tab.tsx`).

**Qué hace**: la cuenta **no se elimina al instante**. Tocar el botón
abre `AccountDeletionRequestModal` con una encuesta de salida corta y
completamente opcional ("¿nos cuentas por qué te vas?": 4 opciones
rápidas + un comentario libre) — omitirla por completo y tocar "Enviar
solicitud" funciona exactamente igual. Al enviar, se crea una fila en
`solicitudes_eliminacion_cuenta` con fecha; el usuario ve una
confirmación en la misma pantalla ("Solicitud recibida el [fecha]... se
procesarán conforme a la Ley 1581 de 2012 dentro de los próximos días
hábiles"). La solicitud queda visible para el equipo administrador vía
`GET /admin/account-deletion-requests` (Épica 9) para procesarla — el
**borrado real de los datos personales queda deliberadamente fuera de
esta funcionalidad**: no existe todavía ningún endpoint que borre o
anonimice una cuenta de verdad. `PATCH .../resolve` solo marca la
solicitud como atendida (mismo patrón que `outdated-reports`, RF-025) —
es responsabilidad de quien la atienda (manual por ahora, o de la Épica
9 cuando se construya el resto del panel) hacer el borrado real por
fuera de este endpoint.

### Por qué el motivo/comentario sobreviven a la cuenta

`solicitudes_eliminacion_cuenta.usuario_id` tiene `ON DELETE SET NULL`
(no `CASCADE`) — el día que exista un proceso real de borrado y la fila
de `usuarios` desaparezca, esta fila **sobrevive** con `usuario_id =
NULL`, `motivo`/`comentario` intactos. Es exactamente lo que separa la
retroalimentación de producto (útil incluso después de que la cuenta ya
no exista) de los datos personales que sí se van a eliminar — verificado
con una prueba de integración que borra la fila de `usuarios` a mano y
confirma que la solicitud sigue ahí, desacoplada
(`solicitudesEliminacionCuenta.test.js`).

### Modelo de datos

- `motivo_eliminacion_cuenta` (ENUM nuevo, no uno de los 8 originales
  del Documento 07 — mismo criterio que `estado_negocio` ganando el
  valor `'rechazado'` después): `ya_no_lo_necesito`,
  `no_encontre_lo_que_buscaba`, `problema_tecnico`, `otro`. ENUM real, no
  texto libre como `reportes_negocio.motivo` (RF-025), porque acá las
  opciones son fijas y cerradas por diseño (las 3-4 opciones rápidas del
  botón).
- `solicitudes_eliminacion_cuenta`: `usuario_id` (nullable, `ON DELETE
  SET NULL`), `motivo` (nullable), `comentario` (`TEXT`, nullable),
  `fecha_creacion`, `atendido_en` (nullable — `NULL` hasta que un
  administrador la marque atendida).
- Índice único parcial `WHERE atendido_en IS NULL AND usuario_id IS NOT
  NULL` — impide que la misma cuenta tenga dos solicitudes activas a la
  vez; es la base de la idempotencia de
  `POST /users/me/account-deletion-request` (ver abajo).

### Endpoints

- `POST /users/me/account-deletion-request` — body completamente
  opcional (`reason`/`comment`, o ninguno; un POST sin body en absoluto
  también es válido, ver el `.default({})` en
  `solicitudEliminacionCuenta.validators.js`). **Idempotente**: si ya
  existe una solicitud activa para el usuario, la devuelve tal cual (no
  la sobrescribe, no crea una segunda) — un doble clic en el botón no es
  un error confuso para alguien que ya está por irse.
- `GET /admin/account-deletion-requests` + `PATCH
  .../{requestId}/resolve` — mismo patrón exacto que
  `outdated-reports`/RF-025 (cola FIFO paginada, `armarPagina`,
  fetch→validar→mutar). El admin sí ve `userId` en la lista (necesita
  saber a quién procesarle la solicitud mientras la cuenta todavía
  existe) — no es un dato que se oculte de ese lado.

### Hallazgo: `DELETE /users/me` no es este flujo

`DELETE /users/me` ya estaba declarado en `openapi.yaml` desde antes de
esta funcionalidad ("Eliminar la cuenta propia", `204`), pero **nunca
tuvo ruta ni implementación** — ni en `users.routes.js` ni en
`users.controller.js`. Se dejó así a propósito, con una nota en el
contrato: un `DELETE` con semántica de "borrado en el acto" no puede
representar el flujo real bajo Ley 1581 (que exige un plazo de
procesamiento, no un borrado instantáneo), así que no se intentó
"completar" ese verbo — el flujo real es este endpoint nuevo,
deliberadamente distinto.

### Frontend

- `account-deletion-request-modal.tsx` (nuevo) — mismo patrón visual
  que `ConsentRequiredModal` (PR de consentimientos): overlay
  `fixed inset-0`, panel `rounded-t-card`/`rounded-card`. A diferencia
  de ese modal (bloqueante, con checkboxes obligatorios), acá nada es
  obligatorio — el botón "Enviar solicitud" nunca queda deshabilitado.
- `settings-tab.tsx`: sección "Eliminar cuenta" (estilo de alerta,
  borde/fondo en rojo) — antes de enviar, muestra el botón; después,
  reemplaza el botón por la confirmación con fecha y el plazo de días
  hábiles. Estado puramente local (no hay, a propósito, un
  `GET "¿ya tengo una solicitud activa?"` — no se pidió): recargar la
  página hace reaparecer el botón, pero tocarlo de nuevo no crea una
  segunda solicitud (el backend ya es idempotente) — la única pérdida es
  la confirmación en pantalla, no el estado real.

## 24. Acceso desde la red local (LAN) para probar en un celular real

Fuera del alcance de los Documentos 05-15 — configuración de desarrollo,
no una funcionalidad del producto. Petición directa del usuario, propia
rama (`chore/lan-mobile-dev-access`).

**Qué se ajustó**:

1. `client/package.json`: `"dev": "next dev -p 3001 -H 0.0.0.0"` — antes
   ya bindeaba a todas las interfaces por default (verificado con
   `ss -ltnp`, mostraba `*:3001`, no `127.0.0.1:3001`), pero dejarlo
   implícito depende de que ese default no cambie en una versión futura
   de Next.js. Ahora es explícito.
2. `src/config/env.js`: `CORS_ORIGIN` ahora acepta una lista separada
   por comas (`env.CORS_ORIGIN` pasa de `string` a `string[]`) — el
   paquete `cors` (`app.js`) ya soporta un array de orígenes de forma
   nativa, así que con un solo valor (sin comas) el comportamiento
   sigue siendo idéntico al de antes; no rompe ningún despliegue
   existente (production/staging/CI, que hoy solo configuran un
   origen).
3. `client/.env.example` y `.env.example` (raíz) documentan el caso de
   uso: agregar la IP de red local del computador a
   `NEXT_PUBLIC_API_BASE_URL` (frontend) y a `CORS_ORIGIN` (backend),
   sin dejar de aceptar `localhost` para el uso normal desde el mismo
   computador. Ninguno de los dos archivos `.env.development`/`.env.local`
   reales se tocó — son personales, gitignored, y la IP de red local es
   distinta para cada quien.

**Por qué NEXT_PUBLIC_API_BASE_URL no se cambió en código**: ya era
exactamente lo que hacía falta (`process.env.NEXT_PUBLIC_API_BASE_URL ??
"http://localhost:3000"`, `client/src/lib/api/client.ts`) — el único
ajuste real es de configuración (qué valor tiene esa variable en
`client/.env.local`), no de código.

**Hallazgo verificado en vivo, no solo en teoría**: se confirmó con
`curl` que Next.js sirve la página completa (HTML + referencias a los
chunks de JS) sin ningún bloqueo al pedirla por una IP que no es
`localhost` — la protección `allowedDevOrigins` de Next.js (agregada en
versiones recientes contra sitios externos que intenten leer los
assets de desarrollo por CORS) no aplica a una navegación directa como
la de un celular escribiendo la URL en la barra de direcciones, porque
el navegador trata esa IP como el origen propio de la página, no como
un origen cruzado. No hizo falta configurar `allowedDevOrigins` en
`next.config.ts`.

**Advertencia real para quien desarrolla dentro de WSL2 (Windows)**: los
tres ajustes de arriba resuelven el problema *dentro* de Linux/WSL2,
pero no alcanzan solos si el modo de red de WSL2 es NAT (el default
histórico) — en ese modo, WSL2 tiene su propia IP interna (ej.
`172.28.x.x`, verificado con `ip addr` en este entorno), **inalcanzable
desde otros dispositivos de la red física** como un celular; solo el
mismo Windows host puede llegar a esa IP. La IP que un celular necesita
escribir es la del adaptador WiFi/Ethernet real de Windows (la que
muestra `ipconfig` en Windows, no `ip addr` dentro de WSL), y para que
el tráfico llegue de ahí hasta el servidor dentro de WSL2 hace falta
una de estas dos cosas:

- **Recomendado**: activar el modo de red "mirrored" de WSL2 (Windows
  11 con una versión reciente de WSL) — agregar a
  `%UserProfile%\.wslconfig`:
  ```
  [wsl2]
  networkingMode=mirrored
  ```
  y reiniciar WSL (`wsl --shutdown` desde PowerShell, volver a abrir la
  terminal). Con esto, WSL2 comparte la IP real de Windows directamente
  — sin reenvío manual de puertos.
- **Alternativa** (WSL2 más antiguo, sin modo mirrored): reenviar los
  puertos 3000 y 3001 desde Windows hacia la IP interna de WSL2 con
  `netsh interface portproxy` (PowerShell como administrador) más una
  regla de Firewall de Windows que permita esos puertos entrantes — la
  IP interna de WSL2 cambia en cada reinicio, así que este reenvío hay
  que rehacerlo (o automatizarlo) cada vez.

No se automatizó ninguna de las dos — son pasos del lado de Windows, no
de este repositorio, y dependen de la versión de Windows/WSL de cada
quien.

**Actualización (`chore/dev-lan-persistente`)**: lo de arriba ya no es
del todo cierto — **la alternativa del reenvío de puertos sí se
automatizó**, ver `scripts/dev-lan.sh` más abajo. El modo "mirrored"
sigue siendo la opción recomendada a mano si alguien quiere evitar el
reenvío por completo, pero requiere `wsl --shutdown` (mata la sesión de
WSL2 activa, Docker Desktop incluido) — algo que un script corriendo
DENTRO de esa misma sesión de WSL2 no puede disparar sobre sí mismo sin
cortarse a la mitad, así que `dev-lan.sh` no lo intenta ni lo ofrece.

### `scripts/dev-lan.sh` — todo el stack persistente + acceso por LAN, con un comando

Petición directa del usuario: los servicios (Postgres/MinIO, backend,
frontend) tenían que sobrevivir a cerrar la terminal, y el celular
seguía sin poder alcanzarlos. Un solo script (`bash scripts/dev-lan.sh`,
re-ejecutable, idempotente) resuelve las dos cosas juntas:

1. **Infra** (`docker compose up -d`) — ya persiste sola como daemon,
   sin cambios necesarios ahí.
2. **Migraciones** (`node-pg-migrate up`, corrido dentro de un
   subshell — ver el hallazgo de abajo sobre por qué).
3. **Backend + frontend, vía pm2** (`ecosystem.config.cjs`, nuevo,
   raíz del repo) — `pm2 startOrReload` + `pm2 save`. pm2 sí sobrevive
   a que se cierre la terminal (es un daemon propio, como Docker), pero
   **no sobrevive a un `wsl --shutdown` ni a reiniciar Windows** — este
   entorno corre systemd (`/etc/wsl.conf`, `[boot] systemd=true`), lo
   que en teoría permitiría `pm2 startup` para que arranque solo al
   iniciar WSL2, pero requiere `sudo` y este entorno no tiene sudo sin
   contraseña (mismo límite ya documentado en la sección 30) — así que
   quedó fuera: después de un reinicio real, hay que volver a correr
   este script.
4. **Detección de IPs en vivo** (no hardcodeadas): la IP interna de
   WSL2 (`hostname -I`) y la IP LAN real de Windows, vía
   `powershell.exe` (`Get-NetIPConfiguration`, filtrando la interfaz
   que tiene puerta de enlace por defecto y está activa — así elige el
   adaptador Wi-Fi/Ethernet real y no alguno de los vEthernet internos
   de WSL/Docker/Hyper-V). Confirmado en este entorno: **modo NAT**,
   sin `.wslconfig` en ningún perfil de usuario de Windows (se
   revisaron todos) — IP interna de WSL2 en el rango `172.28.x.x`,
   sobre un adaptador `vEthernet (WSL (Hyper-V firewall))`, IP LAN real
   `192.168.1.8` sobre `Wi-Fi`.
5. **`client/.env.local` y `CORS_ORIGIN`** (`.env.development`, raíz) se
   reescriben en cada corrida con la IP LAN detectada — a diferencia de
   la sección de arriba (que decidió no tocar los archivos reales por
   ser personales), acá sí tiene sentido: es justamente lo que este
   script existe para automatizar, y se re-detecta la IP cada vez por
   si cambió (DHCP).
6. **Reenvío de puertos + Firewall, con elevación disparada por el
   propio script**: genera `C:\Users\<usuario>\ruteando-lan-setup.ps1`
   (con `netsh interface portproxy add ...` hacia la IP interna de WSL2
   vigente + `New-NetFirewallRule` para 3000/3001) y lo corre con
   `Start-Process powershell -Verb RunAs`, que dispara el diálogo de
   UAC de Windows — el script (corriendo como usuario normal dentro de
   WSL2) **no tiene privilegios de Administrador y no puede
   concedérselos a sí mismo**; lo máximo que puede hacer es pedirle el
   permiso a quien esté sentado frente al computador con un clic. Es
   idempotente y se salta el diálogo por completo si el reenvío ya
   apunta a la IP interna de WSL2 vigente (comparando contra
   `netsh interface portproxy show v4tov4`) — solo pide permiso de
   nuevo si esa IP cambió (ej. después de un `wsl --shutdown`).

**Hallazgo real, encontrado en vivo, no anticipado al escribir el
script**: la primera versión sourceaba `.env.development` con
`set -a; source .env.development; set +a` **en el proceso principal
del script** (para tener `DATABASE_URL` disponible al correr las
migraciones) — eso dejaba `CORS_ORIGIN` **exportado en el entorno del
propio script** con el valor de ANTES de reescribir el archivo en el
paso 5. Como `dotenv` (que usa `src/config/env.js`) nunca sobrescribe
una variable que ya existe en `process.env`, el backend que `pm2`
lanzaba a continuación heredaba ese `CORS_ORIGIN` viejo por el entorno
del propio pm2, e ignoraba por completo el valor ya actualizado del
archivo — verificado leyendo `/proc/<pid>/environ` del proceso real y
confirmando con una llamada `Invoke-WebRequest` desde Windows con
`Origin: http://192.168.1.8:3001` que el header
`Access-Control-Allow-Origin` no volvía. Se corrigió envolviendo el
`source` + las migraciones en un subshell (`( set -a; source ...; set
+a; npm run migrate:up )`) — así esas variables nunca se filtran al
resto del script ni a lo que arranca después.

**Verificado de punta a punta, no solo "el script no tiró error"**:
corrida real completa (`bash scripts/dev-lan.sh`) con los servicios
apagados de antes → Postgres/MinIO/backend/frontend arriba, diálogo de
UAC disparado y aprobado, reglas de `portproxy`/Firewall confirmadas
con `netsh interface portproxy show v4tov4` y `Get-NetFirewallRule`
desde PowerShell → **desde el propio Windows host** (no desde WSL —
es la aproximación más cercana a "otro dispositivo de la LAN" que se
puede probar sin un celular físico a mano) contra `http://192.168.1.8:3001`
y `http://192.168.1.8:3000`: `GET /` de la pantalla de login (200, HTML
real), `GET /health` (200), y un `POST /auth/login` real con una cuenta
de demo sembrada (`demo-arepas-dona-rosa@ruteando.test`) con el header
`Origin: http://192.168.1.8:3001` — 200, con el `Access-Control-Allow-Origin`
correcto y un token real de vuelta. **Límite reconocido**: esto no es
lo mismo que probar desde un celular físico — confirma que la ruta de
red completa (IP LAN → Firewall de Windows → portproxy → WSL2) funciona
igual que la usaría un celular, pero no prueba el dispositivo en sí.

### Pruebas

- `tests/unit/env.cors.test.js`: el parseo de `CORS_ORIGIN` (un origen,
  varios separados por coma, espacios/entradas vacías recortadas).
- `tests/integration/cors.test.js`: confirma contra la app real
  (`GET /health`, sin depender de un valor fijo — lee
  `env.CORS_ORIGIN[0]`, portable entre entornos con distinto valor
  configurado, ver `ci.yml`) que un origen permitido recibe el header
  `Access-Control-Allow-Origin` y uno no permitido no lo recibe.

## 25. Datos de demo: `scripts/seedDemoBusinesses.js`

Petición directa del usuario, sin RF asociado — script para poblar el
mapa con negocios visualmente explorables en desarrollo, propia rama
(`chore/seed-demo-businesses`). **Deliberadamente separado de
`scripts/seedLoadTest.js`** en vez de extenderlo: ese script existe para
medir rendimiento (miles de filas anónimas bajo un único dueño sintético,
pensado para borrarse sin mirarlas) y este existe para mirarlas — 5
negocios curados, cada uno con nombre, categoría, foto, WhatsApp y estado
abierto/cerrado propios, pensados para explorarse a ojo en el mapa y para
poder iniciar sesión como cualquiera de los vendedores.

**Uso**:

```
npm run seed:demo          # siembra (o resiembra: limpia primero, idempotente)
npm run seed:demo:clean    # solo elimina los datos de demo
```

**Qué siembra** (todo bajo Ciudad Verde, Soacha — mismo `CENTRO` que
`seedLoadTest.js`/`discovery.test.js`/`map-screen.tsx`):

| Negocio | Categoría | Distancia | Estado ahora* |
|---|---|---|---|
| Arepas Doña Rosa | Arepas | ~250 m | abierto |
| Perros El Parche | Perros calientes y salchipapas | ~350 m | abierto |
| Dulces La Abuela | Dulces y postres | ~900 m | **cerrado** |
| Jugos Frutti Verde | Jugos naturales | ~1.4 km | abierto |
| Empanadas El Fogón | Empanadas | ~3 km | **cerrado** |

\* El horario se calcula contra el día de HOY en hora de Bogotá
(`momentoActualBogota()`, el mismo helper puro de
`disponibilidad.service.js`) — los dos negocios "cerrado" quedan cerrados
específicamente hoy (el resto de la semana con horario normal
08:00–20:00), no eternamente cerrados; los "abierto" quedan 00:00–23:59
todos los días, mismo truco que ya usa `seedLoadTest.js` para garantizar
"abierto ahora" sin depender de la hora exacta en que se corra el script.
Si se corre el script otro día de la semana, cuáles negocios aparecen
"cerrado ahora mismo" no cambia — sigue siendo estos dos.

**Decisiones que valen la pena dejar explícitas**:

- `telefono_verificado = true` se fija directamente en el `INSERT` (se
  salta el flujo real de OTP por SMS, a propósito) — sin esto ningún
  negocio aparecería en `/businesses`/`/businesses/nearby` desde que
  existe la verificación de teléfono (sección 21).
- `ubicaciones.mostrar_ubicacion_exacta = true` (a diferencia del default
  `false` de producción, sección 22) para que el mapa muestre la
  coordenada calculada tal cual, no la versión redondeada a ~111 m de
  "zona aproximada" — así las distancias pedidas (200 m, 900 m, 3 km...)
  se pueden verificar a ojo en vez de quedar enmascaradas.
- Cada negocio tiene su **propia** cuenta de vendedor (a diferencia del
  dueño único compartido de `seedLoadTest.js`), con argon2 real
  (`password123` para los 5) y ambos consentimientos obligatorios
  (`tratamiento_datos`, `terminos_condiciones`) otorgados directamente
  por SQL — para poder iniciar sesión como cualquiera de ellos y probar
  el lado del vendedor (interruptor de ubicación, etc.) sin que
  `ConsentRequiredModal` bloquee y sin pasar por el registro completo.
  Correos bajo `@ruteando.test` (`demo-<slug>@ruteando.test`), igual que
  el resto de las cuentas sintéticas del proyecto.
- Foto de relleno vía `picsum.photos/seed/<slug>/900/600` (servicio
  externo de placeholders) en vez de subir un archivo real — evita tocar
  el pipeline de compresión/S3 (sección Épica 3), fuera del alcance de
  un script de datos de prueba.
- Categorías (Arepas, Perros calientes y salchipapas, Dulces y postres,
  Jugos naturales, Empanadas) **no se borran** con `--clean` — a
  diferencia de la categoría descartable de `seedLoadTest.js`
  ("Seed Load Test"), son categorías reales y reutilizables que tiene
  sentido conservar aunque se borren los negocios de demo.
- `--clean` borra `consentimientos` **antes** que `usuarios` — esa FK es
  `ON DELETE SET NULL`, no `CASCADE` (mismo motivo documentado en la
  sección 23 para `solicitudes_eliminacion_cuenta`); sin este orden
  quedarían filas huérfanas con `usuario_id = NULL`, imposibles de
  volver a limpiar selectivamente. `negocios` sí cascadea
  (ubicaciones/horarios/fotos), así que no necesita el mismo cuidado.

### Corrección del centro de siembra (2026-09-12, `fix/centro-ciudad-verde-seed-demo`)

**Bug real, encontrado por el usuario al comparar las distancias mostradas
en la pantalla de inicio contra lo que el script decía haber sembrado**:
`CENTRO` estaba en `(4.578, -74.217)` — verificado por geocodificación
inversa (Nominatim/OSM) que esa coordenada es "Carrera 3, Ubaté, Comuna
San Humberto, Soacha ciudad", es decir, el **centroide genérico del
municipio completo de Soacha** (cerca de Cazucá/San Mateo), no el barrio
Ciudad Verde. Corregido a `(4.6083, -74.2188)` — verificado contra
Wikipedia (Ciudad Verde: 4°36′06″N 74°12′53″O, dentro del mismo orden de
magnitud) y confirmado por geocodificación inversa como "Avenida Calle
33, Ciudad Verde, Comuna La Despensa, Soacha ciudad".

**Efecto secundario real, no solo un ajuste de coordenada**: recentrar
expuso que el rumbo de "Empanadas El Fogón" (45°, noreste, a 3000 m)
cruzaba a **Bosa, Bogotá D.C.** — verificado por geocodificación inversa
antes de correr el reseed, no algo que se hubiera notado a ojo en el
mapa. Ciudad Verde limita al oriente/noreste/suroriente con la localidad
de Bosa (río Tunjuelo, quebrada Tibaníca) y al sur/suroccidente con el
río Soacha y el humedal Chucuita (ver
[Wikipedia, Ciudad Verde](https://es.wikipedia.org/wiki/Ciudad_Verde)) —
un desplazamiento de 3 km desde un punto tan cerca del borde norte del
barrio sale del municipio o de la zona urbana en la mayoría de
direcciones. Se cambió el rumbo de ese negocio a 160° (sursureste), que
sí resuelve dentro de Soacha ("Calle 24A Bis, Camilo Torres II, Comuna
San Humberto, Soacha ciudad") — la distancia (3000 m) no cambió, solo la
dirección. Los otros 4 rumbos (0°/90°/180°/270°, a 250/350/900/1400 m) se
verificaron uno por uno con el nuevo centro y los 3 más cercanos siguen
resolviendo dentro de "Ciudad Verde, Comuna La Despensa"; el de 1400 m
(oeste) cae ya en "Ciudad Verde, Bosatama, Corregimiento 2 Norte" —
fuera del polígono estrecho del barrio pero todavía dentro de Soacha, sin
tocar el río/humedal que bordea esa zona más al suroccidente.

**Verificado, no asumido**: las 5 coordenadas resultantes se revisaron con
`ST_Distance` contra el nuevo centro (`docker exec ruteando-db-1 psql`)
confirmando 248/350/894/1400/2982 m — la pequeña diferencia frente a los
250/350/900/1400/3000 m nominales es el mismo margen de aproximación
plano que ya tenía el script antes de este fix (`desplazar()` no usa la
fórmula esférica exacta, aceptable a esta escala, <5 km). `npm run
seed:demo` se corrió de nuevo contra la base de desarrollo para
reemplazar los datos sembrados con el centro viejo.

**Límite reconocido**: "dentro de los límites reales de Ciudad Verde
(carreras 24-40, calles 10a-diagonal 38)" solo se cumple literalmente
para los 3 negocios más cercanos (250/350/900 m) — el barrio mismo mide
del orden de 1.5×2.5 km, así que los negocios a 1.4 km y 3 km, por
diseño, caen fuera de ese polígono estrecho en cualquier dirección; lo
que se verificó y corrigió es que sigan dentro del municipio de Soacha y
lejos de un río/humedal o de otro municipio (Bogotá, Mosquera — este
último también descartado al probar rumbos hacia el noroeste antes de
elegir 160°), no que quepan dentro del barrio.

### Datos completos, sin valores genéricos ni vacíos (petición directa del usuario)

Hallazgo real al revisar el script antes de tocarlo: los 6 negocios de
comida (Arepas, Perros, Salchipapas, Dulces, Jugos, Empanadas) tenían
**0 ítems de catálogo** — solo los 3 no gastronómicos (sección 31)
llevaban menú, y de los 9 negocios, **ninguno** tenía `descripcion` en
sus productos (mostraban "Este ítem todavía no tiene descripción",
gestión-catálogo, sección 35) ni una `direccion_referencia` propia —
los 9 compartían el mismo texto calculado "Cerca de Ciudad Verde,
Soacha (~X m del centro)".

Se agregó un menú real de 3-4 ítems a cada negocio de comida, con
recetas y precios distintos incluso entre los dos de "Perros calientes
y salchipapas" (Perros El Parche/Salchipapas Doña Nury) — comparten
categoría, no catálogo, a propósito: dos vendedores reales no venden
exactamente lo mismo. `descripcion` (columna que ya existía en
`productos`, sin usar en este script) a cada uno de los ítems de los 9
negocios, y una `direccionReferencia` específica por negocio
(calle/carrera + un punto de referencia plausible en Ciudad Verde) —
solo texto libre mostrado al usuario, no afecta la coordenada real
(`punto`) ni ninguna consulta geoespacial, así que no hizo falta
re-verificar nada de lo ya confirmado por geocodificación inversa más
arriba en esta sección.

Se mantuvo la mezcla ya existente de `disponible: true/false` y de
ítems con/sin foto en cada negocio (ver comentarios de
`entregaPropia`/`higieneAutodeclarada` más arriba en esta sección) —
eso ya estaba bien pensado para poder verificar a ojo ambos estados, no
hacía falta tocarlo.

**Verificado, no solo corrido sin error**: `npm run seed:demo` contra
la base de desarrollo real, confirmado por `GET /businesses/{id}` (los
4 ítems de Arepas Doña Rosa, con precio/disponibilidad/descripción
correctos) y con Playwright — expandir "Arepa de queso" en el perfil
real muestra la foto, el precio y la descripción nueva juntos, tal
como los vería cualquiera navegando el mapa. Suite completa del
backend sin cambios (522/522) — este script no tiene pruebas propias
(es una herramienta de datos de desarrollo, no código de producto),
pero comparte la tabla `productos` con el resto del backend, así que
correr la suite completa después de tocarlo confirma que el `INSERT`
nuevo (con `descripcion`) no rompió nada que ya dependiera de esa
tabla.

## 26. Rediseño de reseñas: señal pública vs. retroalimentación privada

Fuera del alcance original de los Documentos 05-15 (RF-015/016 no
mencionan nada de esto) — petición directa del usuario, decidida **antes**
de construir la Épica F7 (formulario de reseña, todavía no existía en el
frontend), propia rama (`feature/resenas-feedback-privado`). Reemplaza el
diseño original de RF-015 (reseña = calificación + comentario público) sin
tocar RF-016 (reportar contenido, sin cambios).

**Motivación del usuario, explícita**: separar la señal pública de calidad
(cuántas estrellas, en promedio) de la retroalimentación de mejora, para
que calificar se sienta como un aporte constructivo al vendedor y no como
un castigo público. Un comentario negativo de texto, visible para
cualquiera que mire el perfil, es fácil de leer como una queja pública
permanente; la misma información, entregada solo al vendedor y enmarcada
como "ideas para mejorar", cumple el mismo propósito (RF-015: que la
calificación refleje experiencias reales) sin ese efecto.

**Modelo**:

1. **Lo único público** sobre reseñas es `BusinessProfile.averageRating` +
   `reviewCount` (agregado, sin cambios de código — ya eran el único
   agregado desde la Épica 5/6). **No existe ningún endpoint que devuelva
   texto de una reseña a un tercero** — se eliminó por completo
   `GET /businesses/{businessId}/reviews` (pública, listaba reseñas
   individuales con `comment`).
2. Al calificar (1-5 estrellas, obligatorio), el consumidor puede agregar
   opcionalmente: **etiquetas rápidas** (catálogo fijo y corto, multi-
   selección) y un **comentario privado** de texto libre. Ninguno de los
   dos es obligatorio.
3. Etiquetas y comentario son **privados**: solo los ve el dueño del
   negocio (`GET /businesses/{businessId}/feedback`, nuevo — reemplaza a
   la ruta pública eliminada) y el equipo administrador (cola de
   moderación existente, sin cambios de ruta). Nunca un tercero, nunca
   otro consumidor.
4. El dueño los ve **anonimizados** — el contrato de la respuesta
   (`ReviewFeedback`) no incluye `userId` ni `businessId`, así que es
   estructuralmente imposible, no solo una promesa de la UI, identificar
   quién escribió cada aporte.
5. Encuadre deliberadamente positivo, pedido explícitamente por el
   usuario: la pantalla del dueño se llama "Ideas de tus clientes para
   mejorar", nunca "quejas" ni "reportes" (esas palabras ya están
   ocupadas por RF-016, que es un mecanismo distinto). Tras calificar, el
   consumidor ve "Gracias por tu aporte — ayudas a que los vendedores de
   tu barrio mejoren", sin lenguaje transaccional ("calificación
   enviada", "gracias por tu feedback").

### Catálogo de etiquetas (`etiqueta_resena`, 8 valores, DB en español / API en inglés — mismo patrón que el resto del proyecto)

| DB (Postgres enum) | API (`ReviewTag`) | Español (frontend) |
|---|---|---|
| `comida_caliente` | `hot_food` | Comida caliente |
| `comida_fria` | `cold_food` | Comida fría |
| `buen_trato` | `good_service` | Buen trato |
| `espera_larga` | `long_wait` | Esperé mucho |
| `buen_precio` | `good_price` | Buen precio |
| `precio_alto` | `high_price` | Precio alto |
| `buena_presentacion` | `good_presentation` | Buena presentación |
| `poca_cantidad` | `small_portion` | Poca cantidad |

Catálogo corto a propósito (petición explícita: "que cubra lo más común",
no exhaustivo) — cubre temperatura de la comida, trato, tiempo de espera,
precio y presentación/cantidad, los ejes más comunes de retroalimentación
en comida callejera. `business.mapper.js#REVIEW_TAG_DB_TO_API`/
`REVIEW_TAG_API_TO_DB` son el único lugar que traduce entre los dos
vocabularios (mismo patrón que `STATUS_DB_TO_API`, `DAY_DB_TO_API`, etc.);
`client/src/lib/reviews/review-tags.ts` es el único lugar del frontend con
las etiquetas en español.

### Modelo de datos

- `resenas.comentario` se **renombra** a `comentario_privado` (migración
  `resenas-feedback-privada`) — no se pierde el dato, cambia quién puede
  verlo. Sin backfill necesario: el valor ya existente sigue siendo el
  comentario de esa reseña, solo que ahora nadie más que el dueño/admin lo
  ve.
- `resenas.etiquetas etiqueta_resena[] NOT NULL DEFAULT '{}'` — un array
  de un enum nuevo, no una tabla de relación aparte: el catálogo es fijo y
  pequeño, y una reseña puede llevar varias etiquetas a la vez. **Gap real
  encontrado al implementar, no obvio de antemano**: el driver `pg` no
  conoce el OID dinámico que Postgres asigna a un array de un tipo
  definido por el usuario — sin un cast explícito (`$N::etiqueta_resena[]`
  al escribir, `etiquetas::text[]` al leer), el valor de vuelta es el
  literal crudo de Postgres como string (`"{comida_fria}"`) en vez de un
  array de JS, y el mapper truena al llamar `.map()` sobre él. Ver
  `resenas.repository.js#SELECT_RESENA` (la constante que aplica el cast
  de lectura en cada `SELECT`/`RETURNING` de esa tabla) y su comentario —
  encontrado por la suite de pruebas completa (500 en creación de reseña),
  no en revisión de código.

### Endpoints

- `GET /businesses/{businessId}/feedback` (nuevo) — reemplaza a
  `GET /businesses/{businessId}/reviews` (pública, eliminada). Requiere
  autenticación y ser el dueño del negocio (403 para cualquier otro,
  autorización a nivel de objeto). Devuelve `ReviewFeedback[]`
  (anonimizado) paginado (mismo patrón keyset del resto del proyecto).
  Incluye reseñas `pending` y `approved`, **no** `rejected` — el aporte
  llega al vendedor de inmediato, sin esperar a que un administrador
  apruebe la calificación para el promedio público (esa aprobación sigue
  gatekeeping solo `averageRating`/`reviewCount`, sin cambios); solo se
  excluye lo que un administrador ya determinó abusivo o inapropiado
  (RF-016), consistente con que el equipo administrador sigue viendo la
  retroalimentación completa para poder moderarla.
- `POST /businesses/{businessId}/reviews` — sin cambios de ruta;
  `ReviewInput.comment` se renombra a `privateComment` (más honesto que
  seguir llamándolo "comment" ahora que ya no es público) y se agrega
  `tags` (opcional, sin duplicados — validado en
  `resenas.validators.js`, no a nivel de columna).
- `GET /users/me/reviews` — sin cambios de ruta ni de semántica (el autor
  siempre ve su propia reseña completa, tags/privateComment incluidos:
  es su propio dato).
- `DELETE /reviews/{reviewId}`, `POST /reviews/{reviewId}/report`,
  `GET /admin/reviews/reported`, `PATCH /admin/reviews/{reviewId}/moderate`
  — sin cambios (RF-016 no cambia, tal como pidió el usuario).

### Frontend

- `client/src/components/business/review-form.tsx` (nuevo, adelanta parte
  de la Épica F7): selector de estrellas, chips de etiquetas (visibles
  recién después de elegir una calificación, para no abrumar antes de que
  el usuario haya decidido cuántas estrellas dar) y comentario opcional.
  Maneja 409 (ya calificó este negocio) como un estado final distinto del
  error genérico, con el mismo tono positivo ("Ya calificaste este
  negocio antes. ¡Gracias por tu aporte!") en vez de un mensaje de error.
  Dispara `resena_creada` (`logReviewCreatedEvent`, CLAUDE.md sección 16)
  solo en el 201 real, no en el 409.
- `client/src/components/business/business-feedback-panel.tsx` (nuevo) —
  "Ideas de tus clientes para mejorar", solo se monta cuando
  `business-profile-screen.tsx` determina `isOwner` (mismo campo
  `ownerId === user?.id` que ya usaba el resto del perfil). Sin
  paginación con "cargar más" — un solo `GET` con límite alto (50), mismo
  criterio que `reviews-tab.tsx` para "mis reseñas".
- `business-profile-screen.tsx`: la antigua sección "Reseñas" (que
  montaba `ReviewList`, pública) se reemplaza por una rama de tres
  casos — dueño ve `BusinessFeedbackPanel`; consumidor autenticado
  (no dueño) ve `ReviewForm`; anónimo ve un aviso con link a
  `/login`. `review-list.tsx` se **eliminó** (consumía el endpoint
  público que ya no existe).
- `reviews-tab.tsx` ("mis reseñas", Épica F6): actualizado para leer
  `tags`/`privateComment` en vez de `comment` — sigue siendo de solo
  lectura, sin cambios de alcance.

### Verificado en vivo, no solo con pruebas automatizadas

Backend probado con la suite completa (472 pruebas, incluidas las nuevas
de `GET .../feedback` y del catálogo de etiquetas) y a mano contra la API
real (creación de reseña con etiquetas, lectura del feedback anonimizado,
verificación de que un reporte saca la reseña del agregado público sin
ocultarla del dueño). Frontend verificado con Playwright headless contra
el servidor de desarrollo real (`negocios/{id}` con sesión de consumidor y
de vendedor dueño) — no solo `tsc`/lint — confirmando en pantalla: el
selector de estrellas, los chips de etiquetas, el mensaje de
agradecimiento post-envío, y el panel anonimizado del dueño con datos
reales sembrados vía la API.

### Gaps conocidos

- El catálogo de etiquetas es fijo en código (`business.mapper.js` +
  `review-tags.ts`) — cambiarlo hoy requiere una migración (nuevo valor
  de enum) y un despliegue de frontend, no hay panel de administración
  para editarlo. No se pidió, y ocho valores fijos no lo justifican
  todavía.
- Sin límite de longitud "razonable" adicional sobre `privateComment` más
  allá del `maxLength: 1000` ya heredado del campo anterior — no se pidió
  ninguno distinto.
- `business-feedback-panel.tsx` no expone `moderationStatus` al dueño
  (ReviewFeedback no lo trae) — el dueño no puede distinguir un aporte
  todavía pendiente de uno ya aprobado. No se pidió esa distinción, y
  agregarla filtraría información sobre el proceso de moderación que hoy
  no tiene ningún uso conocido del lado del vendedor.

## 27. Botón "Volver" en el perfil de negocio (bug real, sin RF asociado)

Reportado por el usuario, propia rama (`fix/navegacion-detalle-negocio`):
`GET /negocios/{businessId}` era un callejón sin salida — sin ningún
elemento en el HTML renderizado para volver a Inicio/Mapa, más notorio
todavía justo después de calificar (Épica F7 adelantada, sección 26),
donde el mensaje de agradecimiento queda más abajo en la página sin
ninguna acción para seguir.

### Causa raíz encontrada al revisar, no solo el síntoma reportado

`client/src/app/negocios/[businessId]/page.tsx` es el **único** `page.tsx`
de toda la app que no monta `AppHeader` (el encabezado con
Inicio/Mapa/Perfil que sí tienen `/`, `/mapa` y `/perfil`) — verificado
revisando los 9 `page.tsx` existentes, no solo esta pantalla. No es un
descuido aislado: `AppHeader` asume una sesión activa (enlaces a rutas
detrás de `RequireAuth`, botón "Cerrar sesión"), y el perfil de negocio es
alcanzable **sin sesión** — un link compartido por WhatsApp necesita
funcionar para cualquiera (CLAUDE.md sección 12, por eso esta página es un
Server Component con `generateMetadata`/Open Graph). Montarle `AppHeader`
de todas formas habría sido incorrecto para un visitante anónimo. La
solución fue un botón "Volver" liviano y sin esa suposición
(`client/src/components/ui/back-button.tsx`), no reutilizar `AppHeader`.

**Hallazgo más grande, encontrado en el camino** (documentado en esta
sección, no resuelto en esta rama): `app-header.tsx` ya traía un
comentario propio admitiendo que "la navegación de cuatro destinos que
fija el Documento 08 (sección 5.3.1) todavía no está construida como
tal" — la barra de navegación inferior persistente que CLAUDE.md sección
17 y 18 dan por hecho que existe **nunca se había construido**;
`AppHeader` era un header superior provisional con enlaces de texto, no
la barra de 4 destinos del documento. **Resuelto después, ver sección
28** — `AppHeader` ya no lleva esos enlaces.

### Otras pantallas de "hoja de detalle" revisadas — sin el mismo problema

- Favoritos, Reseñas y Configuración (entonces `favorites-tab.tsx`,
  `reviews-tab.tsx`, `settings-tab.tsx`) **no eran rutas separadas** —
  eran pestañas dentro de `/perfil` (CLAUDE.md sección 17, "mínimo
  scroll, expandir en el mismo lugar"), que sí tenía `AppHeader`. Ningún
  callejón sin salida ahí. (Favoritos se promovió después a su propia
  ruta — `favorites-tab.tsx` ya no existe, ver sección 28 — pero eso no
  cambia la conclusión de este punto: nunca fue un callejón sin salida.)
- `/negocios/nuevo` (asistente de registro) ya tenía su propia salida
  (`WizardShell`, botón `✕` que llama a `onClose`) — documentado desde la
  Épica F5, no un hallazgo nuevo.
- `/legal/terminos-condiciones` y `/legal/tratamiento-datos` ya tenían un
  enlace "Volver" (`legal/layout.tsx`) — a `/` siempre, no history-based,
  porque son alcanzables sin sesión desde el checkbox de registro. Mismo
  espíritu que el fix de esta sección, ya resuelto de antes.
- `(auth)/login` y `(auth)/register` no necesitan salida — son puntos de
  entrada, no pantallas a las que se llega navegando desde dentro de la
  app.

### Diseño del botón

`BackButton` (`client/src/components/ui/back-button.tsx`) —
`position: fixed` (no solo dentro del banner de foto, que desaparece al
hacer scroll — el caso real que motivó el reporte, calificar y quedar sin
acción visible más abajo en la página) en la esquina superior izquierda,
mismo lenguaje visual que `FloatingActionStack` (círculo, sombra, fondo
`bg-surface/90` con blur) pero en la esquina opuesta, sin invadir su
espacio. `router.back()` navega por historial (Inicio o Mapa, según de
dónde vino el usuario, tal como se pidió) — con `window.history.length >
1` como heurística para distinguir "navegó dentro de la app" de "abrió un
link compartido directo" (donde `router.back()` saldría de la app en vez
de navegar dentro de ella); en ese segundo caso cae a `/` por defecto. Es
una heurística, no una garantía — Next.js App Router no expone su propio
índice de historial — pero cubre el caso real reportado.

### Verificado con Playwright, flujo completo pedido por el usuario

Login → Inicio (con geolocalización simulada sobre Ciudad Verde para que
"Cerca de ti" muestre los negocios de demo reales) → abrir un negocio →
calificar (5 estrellas) → confirmar que el botón "Volver" sigue visible
tras hacer scroll hasta el final de la página → tocarlo (nunca el botón
atrás del navegador) → confirmar que la URL vuelve a `/`. Las 3 capturas
del recorrido (antes de calificar, tras calificar con scroll hasta abajo,
y de vuelta en Inicio) confirman visualmente el arreglo, no solo las
aserciones del script.

## 28. Barra de navegación inferior de 4 destinos (implementado)

Cierra el gap que había quedado documentado en la sección 27 ("la barra
de navegación inferior... nunca se construyó") — propia rama
(`feature/barra-navegacion-inferior`).

**Actualización (PR #41, sección 18 — "el mapa pasa a ser la pantalla
principal")**: los 4 destinos y las rutas exactas de esta sección se
describen tal como quedaron en `feature/barra-navegacion-inferior`, que
es anterior a ese cambio de ruteo. Vigente hoy: el destino "Inicio" se
renombró a **"Buscar"** y apunta a `/buscar` (antes `/`); "Mapa" apunta a
`/` (antes `/mapa`, que ahora es solo un redirect). "Favoritos" (`/favoritos`)
y "Perfil" (`/perfil`) no cambiaron. Cualquier ruta `/mapa` citada más
abajo en esta sección (histórica, de cuando se construyó la barra) debe
leerse como `/` hoy.

### Los 4 destinos — de dónde salieron, honestamente

El Documento 08 (sección 5.3.1) **no está en este repositorio ni en el
contexto de Claude Code** — no fue posible leer literalmente esa sección
para confirmar los 4 destinos exactos que el documento original define.
En vez de adivinar en silencio, se le preguntó directamente al usuario,
presentando la reconstrucción más razonable a partir de lo que sí está
documentado en este archivo y en el código (Inicio=F2, Mapa=F3, Perfil=F6,
y Favoritos como su propia épica F8 "la más simple", separada de F6) —
confirmada por el usuario: **Inicio, Mapa, Favoritos, Perfil**.

### Favoritos deja de ser una pestaña de `/perfil`

Antes (Épica F6) "Favoritos" vivía como una de las tres pestañas dentro
de `/perfil`, junto a Reseñas y Configuración. Al promoverla a destino de
primer nivel:

- Se creó `client/src/app/favoritos/page.tsx` (ruta nueva) y
  `client/src/components/favorites/favorites-screen.tsx` — el mismo
  componente que antes era `profile/favorites-tab.tsx` (borrado), con su
  propio `<h1>` de página en vez de ser contenido de una pestaña. **Sin
  cambio de funcionalidad**: sigue siendo de solo lectura —
  marcar/desmarcar favoritos (RF-017, "Épica F8" en el sentido de la
  interacción del corazón) sigue sin construirse; lo único que cambió es
  dónde vive la lista.
- `ProfileScreen` quedó con solo 2 pestañas (Reseñas, Configuración) —
  `favorites-tab.tsx` y su import se eliminaron de ahí, no se dejó un
  código muerto ni una pestaña duplicada compitiendo con la ruta nueva.

### `AppHeader` vs `BottomNavBar` — se decidió cuál patrón queda, no los dos

`AppHeader` tenía enlaces de texto a Inicio/Mapa/Perfil (`activeTab`
prop) — exactamente la navegación que ahora vive en `BottomNavBar`. Se
quitaron esos enlaces (y el prop `activeTab`, que ya no tiene para qué
existir) de `AppHeader`: hoy solo lleva branding (logo/nombre), el enlace
condicional "Registrar negocio"/"Registro asistido" (por rol, sin
relación con los 4 destinos) y "Cerrar sesión". `BottomNavBar` es ahora
la única fuente de verdad de "en qué pantalla principal estoy" — nunca
compiten por la misma pregunta.

**Efecto secundario encontrado y corregido de paso**: `/perfil` tenía
**dos** botones de cerrar sesión al mismo tiempo — el de `AppHeader`
(`onClick={() => logout()}`, sin redirección explícita) y uno propio de
`ProfileScreen` vía `FloatingActionStack` (`await logout(); router.push
("/login")`). Se eliminó el de `ProfileScreen` — `AppHeader` ya está
montado en las 4 pantallas principales, no hacía falta un segundo. Se
mantuvo el comportamiento de `AppHeader` (sin `router.push`) porque es el
que ya usan Inicio y Mapa: cerrar sesión limpia el estado de
autenticación y `RequireAuth` (que envuelve las 4 pantallas) renderiza su
propia pantalla de "inicia sesión" en el lugar, sin necesidad de cambiar
la URL.

### Pantallas fuera de la barra — mismo criterio que `BackButton` (sección 27)

`BottomNavBar` solo se monta dentro de `RequireAuth` en las 4 pantallas
principales (`/`, `/mapa`, `/favoritos`, `/perfil`). Quedan fuera, a
propósito, exactamente las mismas pantallas que ya no llevaban
`AppHeader`:

- `GET /negocios/{businessId}` — sigue siendo alcanzable sin sesión
  (link de WhatsApp, Open Graph); `BackButton` (sección 27) sigue siendo
  su única salida, sin cambios en este PR. **Decisión explícita, no un
  descuido**: no se le agregó `BottomNavBar` condicionada a
  `user` (aunque esta pantalla ya usa `useAuth()` para `isOwner`) — el
  alcance pedido fueron "las pantallas principales", no "cualquier
  pantalla cuando hay sesión". Mostrarla ahí también para un visitante
  con sesión activa es una mejora razonable a futuro, no construida acá.
- `/negocios/nuevo` (asistente de registro) y `/legal/*` — sin cambios,
  ya tenían su propia salida (sección 27).

### Colisiones de layout encontradas y corregidas (no obvias de antemano)

`BottomNavBar` es `fixed`, así que no reserva espacio por sí sola en el
flujo normal del documento — sin ajustar cada pantalla, quedaba
superpuesta sobre contenido real, no solo sobre espacio vacío:

- **`HomeScreen`**: no tenía ningún padding inferior (nunca lo había
  necesitado, sin `FloatingActionStack` en esa pantalla) — se agregó
  `pb-24` para que la última tarjeta de "Cerca de ti" no quedara detrás
  de la barra.
- **`MapScreen`**: más delicado — `BusinessSummarySheet` y
  `MapFiltersSheet` se anclan con `absolute bottom-0` al contenedor del
  mapa (no a la barra ni al viewport), así que sin reservar espacio ahí
  el propio mapa (y esas hojas) se extendían por debajo de la barra fija,
  no hasta su borde. Se agregó `pb-24` al contenedor del mapa.
  `FloatingActionStack` (el círculo de "Mi ubicación"/"Filtros") es
  `fixed`, no `absolute` dentro de ese contenedor — a ese padding no lo
  afecta, por eso se agregó por separado el prop `aboveBottomNav` a
  `FloatingActionStack` (sube el stack de `bottom-6` a `bottom-24`),
  usado en `MapScreen`. Verificado visualmente con una captura de
  Playwright — no solo razonado, el solape real se hubiera visto recién
  al renderizar.
- **`ProfileScreen`**: ya tenía `pb-28` (para su propio
  `FloatingActionStack`, ahora eliminado, ver arriba) — se ajustó a
  `pb-24` por consistencia con el resto, sin que haga falta más ahora
  que no comparte espacio con ningún stack flotante ahí.
- **`FavoritesScreen`** (pantalla nueva): `pb-24` desde el principio,
  mismo criterio que `HomeScreen`.

### Verificado con Playwright

Login → confirmar que `BottomNavBar` es visible → recorrer las 4
pestañas en orden (Inicio → Mapa → Favoritos → Perfil), confirmando en
cada una: la URL cambia a la ruta esperada, exactamente una pestaña
queda con `aria-current="page"`, y es la correcta (nunca dos activas a
la vez, nunca la equivocada) → confirmar que la barra sigue fija tras
hacer scroll. Capturas adicionales confirman visualmente que
`FloatingActionStack` en Mapa quedó por encima de la barra, sin
solaparse, y que Perfil ya no muestra la pestaña Favoritos ni un segundo
botón de cerrar sesión.

### Gaps conocidos, no ocultos

- ~~Marcar/desmarcar favoritos... sigue sin construirse~~ — **resuelto**,
  ver sección 29 (Épica F8 completa: corazón en el perfil y en
  `BusinessCard`, optimistic update, `FavoritesScreen` ya no es de solo
  lectura).
- El perfil de negocio no muestra `BottomNavBar` ni para un visitante con
  sesión activa (ver arriba, "Pantallas fuera de la barra") — decisión de
  alcance, documentada, no un olvido.
- La reconstrucción de los 4 destinos se confirmó con el usuario, pero
  sigue sin verificarse contra el texto real del Documento 08 (no
  disponible). Si ese documento aparece más adelante y dice algo
  distinto, esta sección queda desactualizada hasta que se corrija a
  mano — no hay ninguna forma automática de detectar esa discrepancia.

## 29. Épica F8 completa — marcar/desmarcar favoritos (RF-017)

Cierra el gap que había quedado documentado en la sección 28
("Marcar/desmarcar favoritos... sigue sin construirse") — `FavoritesScreen`
(la lista de `/favoritos`) dejó de ser de solo lectura. Propia rama
(`feature/favoritos-marcar-desmarcar`).

**Backend: sin cambios.** `POST`/`DELETE /businesses/{businessId}/favorite`
y `GET /users/me/favorites` ya existían completos desde la Épica 7
(sección 6 de este archivo) — idempotentes en los dos sentidos (`204` sin
body, `ON CONFLICT DO NOTHING` al marcar, `DELETE` normal al desmarcar,
sin 409/404 por "ya estaba así"), con autenticación obligatoria y su
propia suite de pruebas (`tests/integration/favoritos.test.js`). Este
trabajo fue enteramente de frontend: consumir esos dos endpoints ya
existentes desde un corazón real en la interfaz.

### `FavoritesContext` (`client/src/lib/favorites/favorites-context.tsx`)

Estado compartido de "cuáles negocios son favoritos del usuario actual"
— sin esto, cada corazón (perfil de negocio, y cada `BusinessCard` de
Inicio/Mapa/Favoritos) tendría que pedir su propio estado por separado,
un N+1 real contra `GET /users/me/favorites` por cada tarjeta visible en
una búsqueda. En vez de eso, `FavoritesProvider` (montado en
`layout.tsx`, dentro de `AuthProvider` — depende de `useAuth()`) pide esa
lista **una sola vez** cuando `status === "authenticated"` (mismo límite
de 50 que ya usaba `FavoritesScreen`, "razonable para la cantidad de
favoritos que alguien acumula en la práctica", sin paginación real) y la
guarda como un `Set<string>` de ids en memoria — `isFavorite(id)` es una
consulta O(1) contra ese Set, no una llamada de red.

`toggleFavorite(businessId)` es la pieza de optimistic update pedida
explícitamente por el usuario: actualiza el `Set` de inmediato, antes de
que el `POST`/`DELETE` real confirme, y lo revierte solo si la llamada
falla (`!response.ok`) — el corazón se siente instantáneo sin esperar ida
y vuelta al backend.

### `FavoriteButton` (`client/src/components/business/favorite-button.tsx`)

Componente único reusado en `business-profile-screen.tsx` (círculo fijo
`top-3 right-3`, mismo lenguaje visual que `BackButton` en la esquina
opuesta — no usa `FloatingActionStack`, sección 20, porque ese componente
es para acciones externas tipo enlace/navegación, no para un estado
booleano con optimistic update) y en `business-card.tsx` (así lo heredan
Inicio, Mapa y Favoritos automáticamente, sin tocar esas tres pantallas
por separado — las tres ya reusaban `BusinessCard`). Ícono `Heart` de
Phosphor: `weight="regular"` sin marcar, `weight="fill"` + `text-terracota`
marcado (mismo color que el resto de acentos del sistema de diseño, no un
rojo aparte).

**No se renderiza en dos casos, pedidos explícitamente por el usuario**:

1. **Sin sesión activa** (`!user`) — los tres endpoints de favoritos
   requieren autenticación, mismo criterio que `LocationVisibilityToggle`/
   `OwnDeliveryToggle` (que tampoco ofrecen su acción a un anónimo). A
   diferencia de `ReviewForm` (que sí muestra un aviso "inicia sesión para
   calificar"), acá no se pidió ningún aviso equivalente — el corazón
   simplemente no aparece.
2. **El propio dueño en su propio negocio** (`ownerId === user.id`) —
   verificado con las cinco cuentas de vendedor de
   `scripts/seedDemoBusinesses.js`: cada dueño ve el corazón en los
   negocios de los demás, nunca en el suyo (ni en el perfil, ni en su
   propia tarjeta si apareciera en una búsqueda).

### `business-card.tsx`: corazón como hermano del botón de expandir, no anidado

El encabezado de la tarjeta ya era un único `<button>` (toda la fila
dispara `toggleExpanded()`). Anidar `FavoriteButton` ahí adentro habría
sido HTML inválido (`<button>` dentro de `<button>`) y, en la práctica,
el clic en el corazón también habría disparado el expandir/colapsar por
burbujeo. Se envolvió la fila en un `<div>` con dos hijos hermanos: el
`<button>` original (ahora `flex-1`, conserva el comportamiento de
expandir tocando nombre/categoría/la flecha) y `FavoriteButton` al lado
— este último igual llama a `stopPropagation()` en su `onClick` como red
de seguridad adicional.

### `FavoritesScreen`: filtrada en vivo contra `FavoritesContext`, no solo un refetch

La lista visible (`visibleBusinesses`) se filtra contra
`FavoritesContext#isFavorite`, no directamente contra la respuesta cruda
de su propio `GET /users/me/favorites` — así, desmarcar un favorito desde
**la misma pantalla `/favoritos`** lo hace desaparecer de inmediato (el
caso que pedía explícitamente el plan de pruebas: "quitarlo, y confirmar
que desaparece"), sin depender de navegar fuera y volver para forzar un
refetch. Antes de que `FavoritesContext` termine de cargar (`isLoaded`),
se muestra la lista sin filtrar — filtrar contra un `Set` todavía vacío
mostraría la lista vacía un instante y luego "aparecería" de golpe, un
parpadeo real sin ningún beneficio (en la práctica casi nunca se nota:
`FavoritesProvider` ya carga apenas hay sesión activa, mucho antes de que
alguien navegue hasta `/favoritos`).

### Instrumentación de eventos

`logFavoriteAddedEvent` (`client/src/lib/api/events.ts`) dispara
`tipo_evento = 'favorito_agregado'` (CLAUDE.md sección 16) solo al
**marcar**, nunca al desmarcar — coherente con la tabla de esa sección
("Al marcar un negocio como favorito") y con `resena_creada`/
`registro_negocio` (eventos de una sola dirección, no de estado).

### Verificado con Playwright

Registro de un consumidor nuevo vía la UI real (formulario completo,
checkbox de consentimiento) → perfil de "Arepas Doña Rosa" → corazón
vacío → marcar (optimistic update, `aria-pressed`/`aria-label` cambian de
inmediato) → `/favoritos` muestra la tarjeta → desmarcar **desde esa
misma pantalla** → la tarjeta desaparece sin recargar → recarga real de
la página → confirma que sigue sin aparecer (la fuente de verdad es el
backend, no solo el estado optimista en memoria) → sesión aparte como la
dueña de ese negocio → confirma que el corazón no existe en absoluto en
su propio perfil (ni "vacío" ni "marcado" — cero elementos con ese rol).
Capturas adicionales confirman visualmente el corazón en la tarjeta de
"Cerca de ti" (Inicio) para los negocios ajenos, y su ausencia en la
tarjeta del propio negocio de quien tiene la sesión iniciada.

### Gaps conocidos, no ocultos

- Sin animación de "explosión"/confeti al marcar — un cambio de ícono
  instantáneo (`regular` → `fill` + color) fue lo que se pidió
  ("instantáneo"), no un micro-interacción decorativa adicional.
- El mapa (`/mapa`) hereda el corazón a través de `BusinessCard`/
  `BusinessSummarySheet` sin cambios propios de esa pantalla — no se
  verificó por separado con Playwright (el flujo completo sí se probó en
  Inicio y en el perfil de negocio, que comparten el mismo componente),
  pero no hay ninguna razón para que se comporte distinto ahí.

## 30. Código QR del perfil y sello de higiene autodeclarada

Dos funciones nuevas y relacionadas, ambas sin RF asociado (fuera del
alcance de los Documentos 05-15) — petición directa del usuario, propia
rama (`feature/qr-y-sello-higiene`). Se implementaron juntas porque
ambas viven en la misma pantalla de gestión del negocio (la propia
`business-profile-screen.tsx` cuando `isOwner`, no existe una pantalla
de "editar negocio" separada — ver sección 26/27) y ambas están pensadas
para que el vendedor las use en el punto de venta físico: el QR para que
lo escaneen, el sello para que se vea en el perfil que ese QR abre.

### Código QR del negocio

Genera un QR que apunta directo a `/negocios/{businessId}` (la misma URL
pública que ya sirve de vista previa enriquecida por WhatsApp, CLAUDE.md
sección 12) — visible solo para el dueño
(`client/src/components/business/business-qr-code.tsx`), con botones
"Descargar" (PNG) y "Copiar enlace".

- **Sin dependencia nueva evitable**: se revisó primero que no hubiera
  ya una librería de generación de QR instalada en el proyecto (no
  había ninguna) antes de agregar `qrcode` (con `@types/qrcode`) a
  `client/package.json` — la única dependencia nueva de esta
  funcionalidad.
- **Generado enteramente en el navegador**, sin llamar a ningún
  servicio externo (a diferencia de, por ejemplo, `picsum.photos` para
  fotos de demo, sección 25 — ahí sí es aceptable por ser solo datos de
  prueba): funciona sin conexión, coherente con la PWA instalable
  (CLAUDE.md sección 12), y no depende de ningún endpoint nuevo del
  backend — la URL que codifica ya es pública y accesible sin sesión.
- `window.location.origin` (no una variable de entorno nueva) construye
  la URL absoluta — funciona igual en desarrollo, en la LAN (sección 24
  de CLAUDE.md), en staging y en producción sin configuración adicional.
  Leerlo directamente en el cuerpo del componente (no en un
  `useEffect`/`useState`) es seguro acá porque el componente nunca se
  renderiza en el servidor: solo se monta cuando `isOwner` es `true`,
  algo que depende de `useAuth()` y por lo tanto solo se resuelve
  después de la hidratación.
- El nombre del archivo descargado (`qr-<slug-del-nombre>.png`) sale de
  una función `slugify()` propia del componente — quita tildes
  (normaliza a NFD y descarta los diacríticos combinantes antes de
  pasar a minúsculas), no una dependencia nueva solo para esto.

### Sello de higiene autodeclarada

Campo nuevo `hygieneSelfDeclared` (`negocios.higiene_autodeclarada` en
la base de datos, migración `higiene-autodeclarada-negocio`) que el
dueño activa voluntariamente desde su perfil, declarando que sigue un
conjunto de buenas prácticas de higiene. Mismo patrón exacto que
`ownDelivery`/"Hace domicilios propios" (sección 5/CLAUDE.md, sin
sección propia hasta ahora): vive en `BusinessInput`/`Business`, se
cambia con el mismo `PATCH /businesses/{businessId}` que ya usa el
asistente de registro (sin endpoint nuevo), sin `.default()` en el
validador (Zod) a propósito — un PATCH que no lo menciona conserva el
valor existente, nunca lo restablece en silencio — y con default
`false` en la creación.

**CUIDADO LEGAL, el punto central de esta funcionalidad**: en ningún
texto de esta funcionalidad — ni el corto de la insignia, ni el modal
público, ni la pantalla donde el dueño la activa, ni la descripción del
campo en `openapi.yaml` — se sugiere que RUTEANDO certifica, inspecciona
o verifica el cumplimiento de normas de higiene. Es, en todos los
lugares donde aparece, una AUTOdeclaración voluntaria del vendedor. El
texto exacto vive en un solo lugar
(`client/src/lib/hygiene/hygiene.ts`, mismo criterio que
`review-tags.ts` con el catálogo de etiquetas de reseñas — un único
lugar evita que el texto del toggle y el de la insignia pública
diverjan con el tiempo):

- Insignia pública (corta): "Higiene autodeclarada".
- Aclaración completa (modal, se abre al tocar la insignia — **nunca
  aparece el texto corto sin que se pueda llegar a esta aclaración**):
  > "Este vendedor declaró, por su propia cuenta, que sigue un conjunto
  > de buenas prácticas de higiene en la preparación y manejo de sus
  > alimentos (por ejemplo: lavar y preparar en casa, mantener la
  > comida tapada, manejo seguro del cilindro de gas).
  >
  > Esta declaración es voluntaria y no ha sido verificada por
  > RUTEANDO. No es una certificación oficial de sanidad ni una
  > garantía de cumplimiento de normas sanitarias — RUTEANDO es un
  > intermediario de información, no un ente certificador."
- La misma aclaración se muestra en la pantalla del dueño
  (`HygieneBadgeToggle`) **antes** del interruptor, no como letra
  pequeña después de activarlo — quien está por declarar el sello debe
  leer primero qué implica (y qué no implica) hacerlo.
- `openapi.yaml` (`Business.hygieneSelfDeclared`,
  `BusinessInput.hygieneSelfDeclared`) repite la misma aclaración en la
  descripción del campo, con una nota explícita para quien integre la
  API: "el cliente que integre este campo debe conservar esa aclaración
  en cualquier texto o insignia que lo muestre, nunca presentarlo como
  una certificación o verificación de la plataforma" — para que el
  cuidado legal no dependa solo de que el frontend propio de RUTEANDO
  lo respete.

**Guía de 5 pasos de buenas prácticas** (contenido educativo de
referencia, texto simple sin diseño elaborado, pedido explícitamente
así): vive en el mismo `hygiene.ts`, colapsada detrás de un botón "Ver
guía de 5 pasos de buenas prácticas" dentro de `HygieneBadgeToggle` (no
siempre visible, para no alargar la tarjeta del interruptor). Los 5
títulos son los que pidió el usuario, textual — la descripción de cada
uno es la única redacción propia de esta rama:

1. **Lava y prepara en casa** — lávate bien las manos y lava los
   utensilios antes de preparar tus alimentos.
2. **Tapa siempre tu comida** — protégela del polvo, los insectos y el
   sol mientras la vendes.
3. **Cuídate para cuidar al cliente** — si estás enfermo o tienes
   heridas en las manos, evita manipular alimentos ese día.
4. **El cilindro de gas lejos del paso** — ubica y revisa tu cilindro en
   un lugar seguro, lejos del tránsito de gente.
5. **Usa tu celular a tu favor** — avisa a tus clientes por WhatsApp si
   cambias de horario o de ubicación.

### Datos de demo

`scripts/seedDemoBusinesses.js` (sección 25) suma `higieneAutodeclarada`
a cada negocio, mezclado a propósito (3 en `true`, 2 en `false`) y
deliberadamente independiente del patrón de `entregaPropia` — dos
negocios llevan las dos insignias a la vez (Arepas Doña Rosa, Empanadas
El Fogón), uno lleva solo el sello de higiene sin domicilios (Perros El
Parche), y los otros dos llevan como mucho una sola de las dos, para
poder verificar a ojo que ambas insignias conviven en el mismo perfil
sin pisarse y que cada una aparece/desaparece de forma independiente.

### Verificado con Playwright

Mismo criterio que el resto de las funcionalidades sin test suite
committeada de esta sección del archivo (no hay `playwright.config` ni
carpeta de e2e en el repo — cada verificación de este tipo es un script
exploratorio contra el servidor de desarrollo real, no una prueba
permanente). Se verificó, contra los datos reales sembrados por
`seedDemoBusinesses.js`:

- Visitante anónimo en un negocio **con** el sello: la insignia es
  visible, tocarla abre el modal, y el modal contiene el texto legal
  exacto ("declaración es voluntaria y no ha sido verificada por
  RUTEANDO", "No es una certificación oficial de sanidad"). El mismo
  visitante NO ve ni el bloque de QR ni el interruptor de higiene (son
  solo del dueño).
- Visitante anónimo en un negocio **sin** el sello: la insignia no
  aparece en absoluto.
- Dueño autenticado: ve el bloque de QR (canvas con contenido real,
  texto con la URL pública exacta debajo, descarga de un PNG real vía
  el botón "Descargar" con el nombre de archivo esperado) y el
  interruptor de higiene ya reflejando el valor sembrado (`true` para
  Arepas Doña Rosa) — expandir "Ver guía de 5 pasos" muestra los 5
  títulos pedidos.
- Dueña de un negocio sembrado con el sello en `false`: lo activa
  (interruptor pasa a marcado, sin error) → recarga la página → la
  insignia pública aparece → un visitante anónimo en otra sesión
  también la ve ahora → lo desactiva de nuevo → recarga → la insignia
  desaparece. Deja los datos de demo como estaban al terminar.

**Hallazgo real durante la propia verificación, no solo del código de
producto**: el checkbox de `HygieneBadgeToggle` (y el de
`OwnDeliveryToggle`, que sigue el mismo patrón) es 100% controlado por
React (`checked={enabled}`, donde `enabled` solo cambia cuando el PATCH
resuelve) — el método `.check()`/`.uncheck()` de Playwright asume que la
propiedad `checked` del DOM cambia de inmediato tras un clic nativo, lo
cual no aplica acá (React la revierte al valor de estado mientras la
petición está en curso). El script de verificación usa `.click()` +
espera explícita sobre `aria-checked`, no `.check()`. No es un bug del
producto — es una discrepancia real entre cómo interactúa Playwright con
checkboxes nativos y cómo se comporta un checkbox controlado async;
válido tenerlo presente para cualquier prueba futura sobre estos dos
interruptores.

**Limitación del propio entorno de verificación, no del producto**: este
entorno de desarrollo no tenía instaladas las librerías nativas que
necesita Chromium headless (`libnspr4`, `libnss3`, `libasound2`, entre
otras) y no hay `sudo` sin contraseña disponible para instalarlas con
`apt-get install`. Se resolvió descargando los `.deb` con
`apt-get download` (no requiere privilegios) y extrayéndolos con
`dpkg-deb -x` a un prefijo local, apuntando `LD_LIBRARY_PATH` ahí —
sin tocar el sistema ni requerir la contraseña del usuario. Specific a
este entorno de ejecución, no algo para automatizar en el repo.

### Gaps conocidos, no ocultos

- El toggle de higiene no actualiza la insignia pública en la misma
  carga de página tras cambiarlo — mismo comportamiento ya existente en
  `OwnDeliveryToggle` (la insignia lee de la prop `profile`, inmutable,
  no del estado local del interruptor). Se verificó que el cambio real
  sí se refleja tras recargar/en otra sesión (ver arriba); no se
  "arregló" acá porque hubiera sido tocar un patrón ya establecido y
  usado en otro lado sin que se pidiera.
- El catálogo de la guía de 5 pasos es fijo en código
  (`client/src/lib/hygiene/hygiene.ts`) — cambiar el texto hoy requiere
  un despliegue de frontend, no hay panel de administración para
  editarlo. No se pidió, y el texto no cambia con frecuencia suficiente
  para justificarlo todavía.
- `scripts/seedLoadTest.js` (miles de negocios sintéticos para la
  prueba de carga, sección 10) no se tocó — mismo criterio ya aplicado
  con `telefono_verificado`/`mostrar_ubicacion_exacta` en la
  verificación de teléfono (sección 21): ese script sigue sin sembrar
  `higiene_autodeclarada`, que por default queda en `false`, sin que
  eso afecte la prueba de carga (no filtra por ese campo).

## 31. Expansión de alcance: de "directorio de comida callejera" a "directorio de comercio informal"

**Esto es un cambio de alcance real, pedido explícitamente así por el
usuario — no una categoría más.** Hasta acá, todo el proyecto (sección 0
de este archivo, los 13 documentos de especificación que lo respaldan,
cada texto legal, cada copy de la interfaz) asumía que RUTEANDO era
exclusivamente un directorio de comida callejera y gastronomía informal.
Esta funcionalidad, sin RF asociado (fuera de los Documentos 05-15),
agrega comercio informal NO gastronómico — costura/sastrería, servicios
legales básicos, artesanías, y lo que se agregue después — como un tipo
de negocio igual de válido que un puesto de arepas, no como una
excepción tolerada. Propia rama (`feature/comercio-no-gastronomico`). La
sección 0/1 de este archivo **no se reescribió** — sigue siendo la
traducción operativa de la especificación original, exclusivamente
gastronómica; esta sección es la que documenta dónde y por qué el
alcance real ya no coincide con esa especificación.

### Qué tan genérico era ya el modelo de datos (verificado, no asumido)

Antes de escribir una sola línea de código se revisó `schema.sql`: el
95% del modelo ya era completamente agnóstico al rubro.

- `negocios`: `nombre`/`descripcion`/`categoria_id`/`telefono_contacto` —
  nada asume comida. Un abogado, una costurera y un vendedor de arepas
  son la misma fila con distinta `categoria_id`.
- `productos`: `nombre`/`descripcion`/`precio`/`disponible` — la misma
  fila representa igual de bien "Salchipapa" ($8.000) que "Consulta
  legal básica" ($25.000). No hizo falta ninguna columna nueva, ninguna
  tabla `servicios` aparte.
- `ubicaciones`/`horarios`/`fotos`/`resenas`/`favoritos`/`eventos`: todos
  genéricos por diseño desde el principio (ver secciones 2-30 de este
  archivo) — ninguno tiene una columna o un enum que presuma comida.
- **Lo único que faltaba**: `categorias` no tenía ninguna forma de saber
  qué tan genérico es el catálogo de un negocio de esa categoría — "el
  menú de un restaurante" y "la lista de servicios de un abogado" son
  conceptualmente distintos aunque la fila de `productos` que los
  representa sea idéntica. Esa es, en el fondo, toda la superficie real
  de este cambio: una columna nueva (`categorias.tipo`) y todo lo que el
  frontend hace con ella para no forzar la palabra "Menú" en todas
  partes.

### Modelo de datos

- `tipo_categoria` (ENUM nuevo, 3 valores — mismo criterio que
  `tipo_ubicacion`/`dia_semana`, un catálogo cerrado y pequeño):
  `alimentos` | `productos` | `servicios`. Migración
  `categorias-tipo-comercio-no-gastronomico`.
- `categorias.tipo tipo_categoria NOT NULL DEFAULT 'alimentos'` — default
  explícito a propósito: **ninguna categoría existente cambia de
  comportamiento**, es el requisito central de "agregar las nuevas
  categorías sin romper las existentes de comida". Verificado con una
  prueba de integración (`GET /categories`, ver abajo) que crea una
  categoría con el mismo INSERT mínimo que ya usaba el resto de la suite
  (`INSERT INTO categorias (nombre) VALUES ($1)`, sin tocar) y confirma
  que sigue resolviendo a `type: "food"`.
- 3 categorías nuevas, insertadas por la misma migración (no solo por el
  script de demo — `categorias` no tiene endpoint de creación,
  administrada solo por el equipo del proyecto, ver el comentario
  original en `schema.sql`; sin este INSERT, un vendedor real en
  producción no tendría ninguna categoría no gastronómica real para
  elegir):
  - **Costura y sastrería** → `servicios`
  - **Servicios legales básicos** → `servicios`
  - **Artesanías** → `productos`
- `categorias.service.js#TIPO_CATEGORIA_DB_TO_API` mapea
  `alimentos→food`, `productos→goods`, `servicios→services` — mismo
  patrón español(DB)→inglés(API) que `STATUS_DB_TO_API`/`DAY_DB_TO_API`
  en `business.mapper.js`.

### El "catálogo" — generalizado en el frontend, no en el contrato de `Product`

**Decisión deliberada**: `Product`/`ProductInput`/las rutas
`/businesses/{id}/products` **no se renombraron**. La forma de los datos
(nombre/descripción/precio/disponible/foto) ya servía igual de bien para
un plato, un producto artesanal o un servicio — renombrar `productos` a
`items_catalogo` en la base de datos y en el contrato habría sido un
cambio disruptivo (migración de tabla, breaking change de API) para un
problema que en realidad era solo de **presentación**: qué rótulo lleva
la sección y qué texto muestra cuando está vacía. Se resolvió
enteramente en el frontend:

- `client/src/lib/catalog/catalog-label.ts` (nuevo, único lugar del
  frontend con esta correspondencia — mismo criterio que
  `review-tags.ts`/`hygiene.ts`): mapea `Category.type` a un rótulo de
  sección (`food→"Menú"`, `goods→"Productos"`, `services→"Servicios"`,
  ausente→"Catálogo") y a un texto de estado vacío correspondiente.
- `client/src/app/negocios/[businessId]/page.tsx`: `getCategoryName`
  se convirtió en `getCategory` (devuelve la categoría completa, no solo
  el nombre) — `BusinessProfileScreen` recibe un prop nuevo `catalogType`
  además de `categoryName`.
- `business-profile-screen.tsx`: el `<h2>` que antes decía "Menú" fijo, y
  el texto de "todavía no publicó su menú", ahora salen de
  `resolveCatalogSectionLabel`/`resolveCatalogEmptyState`. El ícono de
  respaldo del banner (cuando el negocio no tiene foto) también se
  volvió dependiente del tipo — antes siempre `CookingPot` (una olla,
  asumiendo comida), ahora `CookingPot` para `food`, `Package` para
  `goods`, `Briefcase` para `services`, `Storefront` genérico si la
  categoría no resolvió. Verificado con Playwright contra un negocio
  recién registrado sin ninguna foto todavía (el caso real donde este
  ícono se ve) — ver más abajo.
- `product-row.tsx`: ya toleraba una foto ausente desde antes de esta
  funcionalidad (`{photoUrl && <img .../>}`) — nada que cambiar ahí para
  que un servicio sin foto se vea bien. Sí se generalizaron dos textos
  que sí asumían comida: el badge "Agotado" (tiene sentido para un plato
  o un producto físico, no para un servicio) pasó a "No disponible"; el
  texto de descripción vacía pasó de "Este plato todavía no tiene
  descripción" a "Este ítem todavía no tiene descripción".

### Otros textos generalizados (auditoría completa, no solo lo obvio)

Se corrió una búsqueda exhaustiva de "comida"/"plato"/"menú"/"antoja"/
"gastronóm" en todo `client/src` antes de dar esto por cerrado — no solo
se tocó lo que saltaba a la vista en la pantalla de perfil:

- `home-screen.tsx`: "¿qué se te antoja hoy?" (asumía comida) →
  "¿qué estás buscando hoy?".
- `search-bar.tsx`: placeholder "Nombre del negocio o tipo de comida" →
  "Nombre del negocio, producto o servicio".
- `business-card.tsx`/`business-profile-screen.tsx`: el fallback cuando
  no hay nombre de categoría pasó de "Comida callejera" a "Comercio
  informal" (fallback defensivo — `categoryId` es obligatorio al crear
  un negocio, así que en la práctica casi nunca se ve).
- `(auth)/register/page.tsx`: el radio del rol vendedor decía
  literalmente **"Vendo comida (vendedor)"** — el hallazgo más
  significativo de esta auditoría, porque es el primer texto que ve
  cualquiera que se registra como vendedor sin importar su rubro. Pasó a
  "Tengo un negocio (vendedor)".
- `layout.tsx` (meta description PWA), `require-auth.tsx` (pantalla de
  "inicia sesión"), `negocios/[businessId]/page.tsx` (descripción Open
  Graph por negocio — esta es la más importante de las tres: es lo que
  ve cualquiera que reciba el link de un negocio no gastronómico por
  WhatsApp), `legal/tratamiento-datos/page.tsx` y
  `legal/terminos-condiciones/page.tsx` (párrafo de apertura de ambos
  textos legales) — todos actualizados para hablar de "comercio
  informal" en vez de asumir comida. `package.json` (raíz) y
  `openapi.yaml` (`info.title`/`info.description`, el summary de
  `GET /categories` y los summaries de las rutas de productos) también.
- **Deliberadamente NO tocado**: las URLs de `servers:` en
  `openapi.yaml` (`ciudadverdegastronomica.co`) — son infraestructura
  real, no prosa, y cambiar un dominio no es parte de este alcance. El
  ícono de carga de `RequireAuth` (`CookingPot`, mostrado mientras
  resuelve la sesión, antes de saber nada del negocio) tampoco — no hay
  ningún negocio en contexto todavía en esa pantalla para elegir un
  ícono distinto, y es branding de la app entera, no de un perfil.

### Datos de demo

`scripts/seedDemoBusinesses.js` suma 3 negocios no gastronómicos a los 5
gastronómicos originales — uno por cada categoría nueva, cada uno con su
propio catálogo de 2-3 ítems (`productos`/`foto` opcional por entrada de
`NEGOCIOS`, con default `'alimentos'`/`[]` para no tener que tocar las 5
entradas de comida existentes):

| Negocio | Categoría | Tipo | Catálogo |
|---|---|---|---|
| Costuras y Arreglos María | Costura y sastrería | `servicios` | 3 servicios, **sin fotos** (demuestra que "Servicios" no las fuerza) |
| Asesoría Legal Rápida | Servicios legales básicos | `servicios` | 3 servicios, sin fotos |
| Artesanías Telar Andino | Artesanías | `productos` | 3 productos, **con foto** cada uno (pedido explícito del usuario: "productos con foto y precio para un artesano") |

`entregaPropia`/`higieneAutodeclarada` en `false` para los tres —
explícito, no un olvido: ninguna de las dos aplica a un servicio (no hay
"domicilio del producto" que declarar en una consulta legal, ni "higiene
en la preparación de alimentos" en un arreglo de ropa).

Las coordenadas de los 3 negocios nuevos reusan los mismos rumbos ya
verificados por geocodificación inversa para los negocios originales
(sección 25: 0°/norte, 90°/este, 180°/sur — todos confirmados dentro de
Soacha/Ciudad Verde), pero a una distancia **menor** que el punto ya
verificado en cada rumbo (150 m/200 m/500 m vs. los 250 m/350 m/900 m
verificados) — un punto más cerca del centro sobre un rayo ya
confirmado seguro no necesita una nueva geocodificación.

La consulta `INSERT INTO categorias (nombre, tipo) VALUES ($1, $2) ON
CONFLICT (nombre) DO UPDATE SET nombre = ..., tipo = ...` manda `tipo`
explícito (con default `'alimentos'` para las categorías de comida) en
vez de confiar en que la migración ya corrió antes — defensivo, para que
el script siga etiquetando bien las categorías nuevas sin importar el
orden en que se ejecuten migración/seed en un entorno nuevo.

### Verificado con Playwright

Mismo criterio que el resto de las funcionalidades de esta sección del
archivo (sin test suite e2e committeada — ver sección 30): script
exploratorio contra el servidor de desarrollo real, con los datos reales
sembrados por `seedDemoBusinesses.js`. Encontró y corrigió dos problemas
reales del script de verificación (no del producto) en el camino, ambos
por el mismo motivo de fondo — `locator.isVisible()`/`.check()` de
Playwright no esperan, evalúan el estado exacto en el instante en que se
llaman:

1. Un `getByText(...).isVisible()` inmediato tras `page.goto()` podía
   correr antes de que el asistente de registro (cliente puro, sin SSR)
   terminara de hidratarse — se reemplazó por un helper `waitVisible()`
   que sondea hasta un timeout, mismo espíritu que el fix de
   `.check()`/`.uncheck()` documentado en la sección 30.
2. `button[aria-expanded]` sin acotar a la sección del catálogo también
   matcheaba el botón de las Next.js Dev Tools (`aria-expanded` en su
   propio botón de menú, visible solo en modo desarrollo) — se acotó el
   selector a la sección que contiene el `<h2>` del catálogo.

Verificado de punta a punta:

- **Registro real de un negocio no gastronómico**: cuenta de vendedor
  nueva → asistente completo (detalles con categoría "Costura y
  sastrería", ubicación, horario) → llega a "¡Listo!" sin ningún error →
  el perfil propio (recién creado, sin fotos, pendiente de aprobación)
  muestra el catálogo rotulado "Servicios" (nunca "Menú") y el ícono de
  respaldo del banner es el maletín (`Briefcase`), no la olla de comida.
- **Búsqueda por texto**: "legal" encuentra "Asesoría Legal Rápida".
- **Búsqueda por categoría (chip)**: el chip "Artesanías" (categoría
  nueva, en la fila de categorías rápidas de Inicio) filtra
  correctamente y muestra "Artesanías Telar Andino".
- **Perfil público de un negocio de bienes** (Artesanías Telar Andino):
  catálogo rotulado "Productos", los 3 ítems sembrados visibles, el
  primero expandido muestra su foto y el precio formateado en COP
  (`$ 55.000`), el ítem marcado `disponible: false` muestra el badge
  "No disponible" (ya no "Agotado").
- **Perfil público de un negocio de servicios** (Asesoría Legal Rápida):
  catálogo rotulado "Servicios", los 3 ítems sembrados visibles, la
  única `<img>` de toda la página es la foto de portada del negocio — un
  servicio sin foto no fuerza ninguna imagen en su fila expandida.

### Gaps conocidos, no ocultos

- **Las etiquetas rápidas de reseñas siguen centradas en comida**
  (`comida_caliente`/`comida_fria` → "Comida caliente"/"Comida fría",
  ver sección 26) — quedan raras en el feedback privado de una
  costurera o un abogado. No se tocó: cambiar el catálogo de etiquetas
  requiere una migración de enum (los valores de un ENUM de Postgres no
  se pueden quitar, solo agregar) y no fue parte de lo pedido para esta
  funcionalidad — queda documentado como pendiente para cuando se
  aborde el catálogo de etiquetas de reseñas específicamente.
- **`OwnDeliveryToggle`/"Hago domicilios propios"** sigue apareciendo
  igual en el asistente de registro y en el perfil sin importar el tipo
  de categoría — no se ocultó condicionalmente para `services` (un
  vendedor de servicios simplemente no lo marca; es opcional). No se
  pidió esa distinción y agregarla habría sido sobre-diseñar un checkbox
  opcional.
- **Sin panel de administración para el catálogo de categorías**: siguen
  administrándose solo por migración/SQL directo, mismo criterio que
  desde el principio del proyecto (ver `schema.sql`) — agregar una
  cuarta categoría (o un cuarto `tipo`) en el futuro sigue siendo
  trabajo de backend, no algo que un administrador pueda hacer desde la
  interfaz. No es una regresión de esta funcionalidad, es una limitación
  preexistente que esta funcionalidad no intentó resolver.
- El campo `icon` de `Category` sigue sin usarse en ningún lado del
  frontend (ni `CategoryChips` ni el selector del asistente lo leen) —
  las 3 categorías nuevas se sembraron sin ícono propio, igual que la
  mayoría de las categorías de comida existentes. Si en el futuro se
  diseña un set de íconos por categoría, este campo ya existe para
  eso — no hizo falta agregarlo en esta funcionalidad.

## 32. Zonas de aglomeración

Sin RF asociado (fuera de los Documentos 05-15) — petición directa del
usuario: agrupar negocios por proximidad geográfica real y comparar la
variedad de comercio disponible entre zonas cercanas, "incluso cruzando
a otro barrio", en vez de mostrar solo pines sueltos en el mapa. Propia
rama (`feature/zonas-aglomeracion`).

### Trade-off técnico (decidido ANTES de implementar, como pidió el usuario)

**Opción A — clustering en tiempo real por consulta** (PostGIS
`ST_ClusterDBSCAN`, sin tabla nueva) vs. **Opción B — zonas
precalculadas** (tabla `zonas` materializada, con un job/cron que la
recalcule periódicamente).

Se eligió **A**, por estas razones concretas:

1. **Escala real del proyecto**: RUTEANDO es un directorio de UN barrio
   (Ciudad Verde, Soacha — CLAUDE.md sección 0), no una ciudad completa.
   La prueba de carga de la Épica 4 (sección 10) ya demostró que
   `ST_DWithin` + un índice GIST maneja 5.000 negocios sintéticos con
   p95≈150ms — clusterizar el subconjunto dentro de un radio de
   búsqueda (unas pocas decenas o cientos de filas en el peor caso
   realista) con `ST_ClusterDBSCAN` sobre esos mismos negocios ya
   indexados es, en la práctica, un costo marginal sobre una consulta
   que el proyecto ya sabe que es rápida a esta escala — no la misma
   pregunta que "clusterizar todo Bogotá en cada request".
2. **Coherencia con el resto del proyecto**: cada vez que este archivo
   documenta una decisión de "tiempo real vs. precalculado", gana tiempo
   real — expiración perezosa de `solicitudes_disponibilidad` (sección
   11), de `codigos_recuperacion`/`codigos_verificacion_telefono`
   (secciones 1/21), "abierto ahora" calculado contra el reloj en cada
   petición (Épica 4) — **nunca** se introdujo un cron en este proyecto
   todavía, y una tabla `zonas` materializada lo habría requerido
   (recalcular cuando se aprueba/suspende un negocio, cuando cambia de
   ubicación, cuando se verifica su teléfono...). Zonas precalculadas
   son correctas hasta el próximo recálculo, nunca antes — inconsistente
   con que un negocio recién aprobado (RF-019) o recién verificado por
   SMS (sección 21) ya es visible de inmediato en `/businesses` y
   `/businesses/nearby`; una zona precalculada obsoleta contradiría esa
   frescura en la misma pantalla del mapa.
3. **Encaje técnico real, no solo conveniencia**: la definición que pide
   esta funcionalidad ("radio de distancia, densidad mínima") es
   literalmente la firma de `ST_ClusterDBSCAN(geom, eps, minpoints)` —
   no hubo que inventar un algoritmo de agrupación propio ni forzar el
   problema a encajar en una herramienta pensada para otra cosa.
4. **Sin tabla nueva, sin migración**: sección 5 de este archivo. sin
   ids de zona persistentes que mantener consistentes, sin decidir qué
   pasa con negocios que "cambian de zona" cuando otro negocio cercano
   se aprueba o se cierra — ese problema completo desaparece cuando la
   zona es, por definición, "lo que resulta de consultar ahora mismo".

**Costo real aceptado, no ignorado**: cada consulta a
`GET /businesses/zones` reclusteriza desde cero (sin caché) — aceptable
mientras el volumen real de negocios por radio de búsqueda siga siendo
del orden de decenas/cientos (el caso real de un solo barrio), no miles.
Si el piloto creciera mucho más allá de eso, cachear el resultado por
un TTL corto (no una tabla materializada completa, solo una capa de
caché sobre el mismo cómputo) sería el primer paso razonable antes de
migrar a zonas precalculadas — no se implementó por no ser necesario
hoy (regla del proyecto: no construir para una escala que no existe
todavía).

### Qué hace a un grupo de negocios una "zona"

`ST_ClusterDBSCAN` sobre `ubicaciones.punto` de negocios `activo` +
`telefono_verificado` (mismo filtro de visibilidad que
`/businesses`/`/businesses/nearby`), con dos parámetros propios, no
citados de ningún documento (`src/config/constants.js`):

- **`ZONE_RADIUS_METERS = 200`** (el `eps`) — un radio caminable de
  "misma cuadra/par de cuadras": agrupa lo que un consumidor recorrería
  a pie sin pensarlo como "otro viaje", sin fusionar zonas realmente
  distintas del barrio.
- **`ZONE_MIN_BUSINESSES = 3`** (el `minpoints`) — con 2 negocios cerca
  no hay mucho que comparar todavía; 3 es el mínimo para que agruparlos
  se sienta como una "zona" real. Nota técnica de `ST_ClusterDBSCAN`:
  minpoints cuenta el punto mismo, así que en la práctica hacen falta
  al menos 3 negocios mutuamente cercanos.

Un negocio sin suficientes vecinos dentro de `eps` queda como "ruido"
(`cluster_id = null` para DBSCAN) — no forma zona, pero sigue
apareciendo como pin individual en el mapa exactamente igual que antes
de esta funcionalidad; esta funcionalidad es un resaltado adicional,
nunca un reemplazo de los pines.

### `GET /businesses/zones`

Público (`security: []`, igual que `/businesses/nearby`), parámetros
`lat`/`lng` (obligatorios, mismo chequeo de caja de Cundinamarca que el
resto de los endpoints geoespaciales) y `radiusKm` (default 3 — más
generoso que el default de `/businesses/nearby` (2), porque comparar
"la zona más cercana con más variedad, incluso cruzando a otro barrio"
necesita ver más allá del radio inmediato de negocios individuales).
Deliberadamente **sin** los filtros combinables de RF-010/011
(categoría/texto/precio/abierto ahora) — filtrar antes de clusterizar
fragmentaría las zonas de forma engañosa (con `categoryId` puesto, una
zona de 4 categorías se vería como una de 1, perdiendo justo la señal
de variedad que este endpoint existe para mostrar).

Devuelve `BusinessZone[]`, ordenado por distancia ascendente al punto
de búsqueda:

```
{
  id,                // válido solo dentro de esta respuesta, nunca persistente
  centerLatitude, centerLongitude,  // centroide = promedio simple de lat/lng de los miembros
  businessCount,
  categoryCount,     // la señal de "variedad"
  categories: [{ categoryId, categoryName, count }],  // más frecuente primero
  distanceMeters,    // al miembro MÁS CERCANO de la zona, no al centroide
}
```

Implementación dividida a propósito entre PostGIS y JS:
`negocios.repository.js#clusterizar` hace la parte cara (clustering
espacial, sobre el índice GIST existente) y devuelve una fila por
negocio con su `cluster_id`; `zonas.service.js#agruparEnZonas` (función
**pura**, sin acceso a datos) agrupa esas filas en zonas — separada así
para poder probarla con filas de prueba hechas a mano, sin mockear el
repositorio ni tocar la base de datos, mismo criterio que
`disponibilidad.service.js#estaAbiertoAhora`/`business.mapper.js` en
este mismo archivo. `ST_ClusterDBSCAN` exige `geometry`, no `geography`,
y su `eps` se mide en las unidades del sistema de coordenadas de esa
geometría — en 4326 (grados) un `eps` en metros no significa nada, así
que la consulta transforma a Web Mercator (SRID 3857) solo para el
clustering; la distorsión de esa proyección es insignificante a esta
escala (agrupaciones de ~200m, cerca del ecuador) — mismo tipo de
aproximación plana ya aceptado en
`scripts/seedDemoBusinesses.js#desplazar`.

### En el mapa

`leaflet-map.tsx` recibe una prop `zones` nueva y dibuja un `<Circle>`
translúcido (color `mostaza`, para distinguirse de los pines
`terracota`) por zona, con un `<Tooltip>` con el resumen
("N negocios · M tipos de comercio distintos"). Esto es un resaltado
**adicional**, no un reemplazo de `react-leaflet-cluster`
(`MarkerClusterGroup`), que ya vivía en el proyecto desde la Épica F3 —
son dos cosas distintas que conviven sin pisarse: `MarkerClusterGroup`
agrupa pines por proximidad en PÍXELES de pantalla según el zoom (una
optimización visual estándar de cualquier mapa con muchos puntos, sin
ningún conocimiento de categorías ni variedad), mientras que los
círculos de zona son 100% datos reales de `GET /businesses/zones`
(proximidad geográfica real, con resumen de variedad) — el hallazgo
central que motivó esta funcionalidad es que lo primero ya existía y no
alcanzaba para lo que pedía el usuario. Los círculos se dibujan en el
`overlayPane` de Leaflet, que por diseño queda debajo del `markerPane`
(z-index 400 vs. 600) sin importar el orden en el JSX — los pines
individuales siguen siendo el objetivo de clic principal.

### Comparación entre zonas cercanas

`ZoneComparisonCard` (nueva, `client/src/components/map/zone-comparison-card.tsx`):
`zones` ya viene ordenado por distancia ascendente, así que
`zones[0]` (la más cercana al consumidor) es el proxy de "la zona en la
que está" — sin necesitar un concepto aparte de "estoy DENTRO de una
zona" con su propio umbral (ver el trade-off de arriba: mantener esto
simple fue deliberado). `betterZone` es la siguiente zona más cercana
con **estrictamente más** `categoryCount` que la actual; si no existe
(la más cercana ya es la más variada, o solo hay una zona en el radio),
el componente no renderiza nada — no hay nada que sugerir. Solo se
piden zonas con geolocalización concedida (sin un punto de referencia
real del consumidor, "la zona en la que estás" no significa nada); sin
geolocalización, el mapa sigue mostrando pines individuales
normalmente, solo se pierde el resaltado y la comparación.

`client/src/lib/zones/zone-format.ts` — `WALKING_SPEED_METERS_PER_MINUTE
= 80` (~4.8 km/h, cifra propia no citada de ningún documento, un
promedio habitual de caminata urbana casual) convierte `distanceMeters`
a minutos para el texto "A ~X min caminando hay una zona con...". "Ver
esa zona" recentra el mapa sobre el centroide de la zona sugerida
(mismo `mapInstanceRef.current.setView` que ya usa "Mi ubicación").

### Datos de demo

`scripts/seedDemoBusinesses.js`: las posiciones originales (5 rumbos
distintos desde el centro, pensadas para "Cerca de ti", RF-009) casi
nunca quedaban a menos de 200m entre sí — se **reacomodaron** (mismos
ids/slugs/categorías/fotos, solo coordenadas) 4 de los 9 negocios, y se
agregó 1 nuevo, para formar dos zonas reales y claramente distintas
(verificado a mano con `ST_ClusterDBSCAN` contra la base de desarrollo
antes de escribir el script, no solo calculado en teoría):

| Zona | Rumbo | Miembros | Categorías | Variedad |
|---|---|---|---|---|
| Norte | 0° (150-250m) | Costuras y Arreglos María, Asesoría Legal Rápida (movida), Artesanías Telar Andino (movida), Arepas Doña Rosa | Costura y sastrería, Servicios legales básicos, Artesanías, Arepas | **4** categorías |
| Este | 90° (300-350m) | Salchipapas Doña Nury (nueva), Jugos Frutti Verde (movida), Perros El Parche | Perros calientes y salchipapas (×2), Jugos naturales | **2** categorías |

Salchipapas Doña Nury comparte categoría con Perros El Parche a
propósito — la zona este necesitaba MENOS variedad que la zona norte
para poder demostrar la comparación ("desde la zona este, sugerir la
zona norte"), no solo tener 3 negocios cualquiera cerca. Dulces La
Abuela (900m@180°) y Empanadas El Fogón (3000m@160°) quedan sin
cambios, deliberadamente aislados — no todo negocio tiene que estar en
una zona. Todas las coordenadas nuevas caen por debajo del máximo ya
verificado por geocodificación inversa en el mismo rumbo (sección 25:
0° seguro hasta 250m, 90° seguro hasta 350m) — un punto más cerca del
centro sobre un rayo ya confirmado dentro de Soacha no necesita nueva
verificación (mismo criterio ya aplicado en la sección 31).

### Verificado con Playwright

Mismo criterio que el resto de las funcionalidades de esta sección del
archivo (sin test suite e2e committeada — script exploratorio contra el
servidor de desarrollo real, con los datos reales sembrados de arriba):

- Parado en la zona este (baja variedad, geolocalización mockeada en
  las coordenadas reales de Perros El Parche): el mapa dibuja
  exactamente los 2 círculos de zona esperados, los pines/clusters
  individuales se siguen mostrando, y la tarjeta de comparación aparece
  con el texto exacto — "Estás cerca de una zona con 2 tipos de
  comercio distintos. A ~5 min caminando hay una zona con 4 tipos de
  comercio distintos." (el ~5 min calculado coincide con la distancia
  real medida a mano por PostGIS antes de escribir el seed:
  ~380m ÷ 80 m/min ≈ 4.75 → 5). "Ver esa zona" se puede tocar sin
  error; una captura antes/después confirma visualmente que el mapa
  recentra sobre la zona norte, con sus dos círculos de zona (`mostaza`,
  translúcidos) claramente visibles alrededor de los clusters de pines.
- Parado en la zona norte (ya la más variada de las dos): las zonas se
  siguen dibujando, pero la tarjeta de comparación NO aparece — no hay
  ninguna zona cercana con más variedad que sugerir.

### Gaps conocidos, no ocultos

- **Sin caché**: cada llamada a `GET /businesses/zones` reclusteriza
  desde cero (ver el trade-off arriba) — aceptable a la escala real de
  un solo barrio, documentado como el primer paso a dar si el piloto
  creciera mucho más allá de eso.
- **El "estoy en esta zona" es un proxy, no una pertenencia real**: la
  zona más cercana al punto de búsqueda puede no ser, técnicamente, una
  zona que "contiene" al consumidor (si está a 500m de cualquier zona,
  igual se trata la más cercana como "la actual"). Se consideró un
  umbral explícito (`distanceMeters <= ZONE_RADIUS_METERS`) para decidir
  "adentro vs. afuera" y se descartó a propósito por simplicidad — la
  redacción ("Estás CERCA de una zona con...") ya es honesta sobre esto,
  no promete "estás DENTRO".
- **Sin nombre propio por zona** ("Zona Norte", etc.) — nombrar una zona
  requeriría geocodificación inversa por centroide (otra dependencia
  externa) o un catálogo de zonas administradas a mano, ninguna de las
  dos pedida. La zona se identifica por su resumen (negocios/variedad),
  no por un nombre.
- El radio de 200m del círculo dibujado en el mapa es una aproximación
  visual (una zona real de DBSCAN no es necesariamente circular) — no
  es una representación geométrica exacta del cluster, es una señal de
  "por acá hay una aglomeración", suficiente para el propósito.

## 33. Carga de fotos desde el frontend, y corrección del catálogo de etiquetas de reseñas

Dos funcionalidades sin épica/RF asociado hasta ahora, pedidas juntas —
propia rama (`feature/carga-fotos-frontend`). La primera cierra un gap
real: el backend de fotos (Épica 3) existía completo desde hace mucho,
pero **nunca hubo ninguna forma de usarlo desde la web** — ni en el
asistente de registro ni en el perfil de negocio. La segunda corrige un
bug ya documentado como gap conocido (sección 31).

### Carga de fotos — negocio y catálogo

`PhotoUploadControl` (nuevo, `client/src/components/business/photo-upload-control.tsx`)
es el único componente de carga, reusado tal cual para la foto principal
del negocio (`business-profile-screen.tsx`) y la foto de cada
producto/servicio del catálogo (`product-row.tsx`, dentro de la fila
expandida) — la lógica de reemplazo es idéntica en los dos casos, solo
cambian las funciones de subida/borrado que se le pasan como props (ver
`client/src/lib/api/photos.ts`). Consume los endpoints reales de la
Épica 3 (`POST /businesses/{businessId}/photos`,
`POST /products/{productId}/photos`, `DELETE /photos/{photoId}`), sin
ningún mock — respeta las validaciones que ya existían en el backend
(tipo de archivo real vía Sharp, `PHOTO_MAX_SIZE_BYTES`), duplicadas del
lado del cliente en `client/src/lib/photos/photo-constraints.ts` solo
para dar feedback inmediato antes de gastar una subida completa (mismo
criterio que `ZONE_RADIUS_METERS` en la sección 32 — dos codebases sin
paquete compartido).

**Vista previa antes de subir** (pedido explícito): seleccionar un
archivo no sube nada todavía — muestra una vista previa local
(`URL.createObjectURL`, revocada al cambiar de archivo o desmontar) con
botones "Subir foto"/"Cancelar". Solo al confirmar se dispara la subida
real.

**Reemplazo, no acumulación** (pedido explícito, pensando en las fotos
de relleno de picsum.photos del seed de demo): el backend no impone un
límite de fotos por negocio/producto (`fotos.repository.js#crearConOrdenSiguiente`
simplemente le asigna el siguiente `orden_visualizacion`), así que sin
ningún criterio del lado del cliente, cada subida se habría ido
acumulando sin límite. `PhotoUploadControl` en cambio trata "ya había
una foto" (real o de relleno — desde acá son indistinguibles, y se
tratan igual a propósito) como un reemplazo: sube la nueva primero y,
solo si eso tuvo éxito, borra la anterior (`DELETE /photos/{photoId}`,
best-effort — si ese borrado falla, no se revierte la subida nueva ni
se bloquea al vendedor). El texto "Al subir una foto nueva, reemplaza
automáticamente la anterior — incluida la foto de muestra, si todavía
no habías subido una propia" queda siempre visible bajo el control, para
que esto sea explícito en la interfaz, no solo un comportamiento
implícito del código.

**Hallazgo real al diseñar el reemplazo, no obvio de antemano**: como el
borrado de la foto anterior es best-effort (puede fallar), y
`GET /businesses/{businessId}` devuelve `photos` ordenado ASCENDENTE por
`displayOrder` (`fotos.repository.js#listarPorNegocio`,
`ORDER BY orden_visualizacion`), el `.find()` que ya usaba
`business-profile-screen.tsx`/`product-row.tsx` para elegir "la" foto a
mostrar tomaba la PRIMERA coincidencia — es decir, la más ANTIGUA, no la
más reciente. Antes de esta funcionalidad eso nunca importó (el seed de
demo nunca sembró más de una foto por negocio/producto); con una subida
real que puede convivir un instante (o para siempre, si el borrado de la
vieja falla) con la anterior, mostrar la más antigua habría hecho que
"reemplazar" pareciera no funcionar. Se agregó
`client/src/lib/photos/pick-latest-photo.ts#pickLatestPhoto` (por
`displayOrder` más alto, no por posición en el array) y se usa en los
dos lugares — así, incluso si el borrado de la foto vieja falla, lo que
se ve en el perfil es siempre la más reciente.

**Orden de varias fotos — revisado, como pidió el usuario**: sí importa
(`orden_visualizacion`/`displayOrder`, asignado automáticamente por
`crearConOrdenSiguiente` con un `pg_advisory_xact_lock` por dueño, ver
sección 6 de este archivo, Épica 3) pero no hay ningún endpoint para
reordenar fotos a mano, y no se construyó ninguna UI de "arrastrar para
reordenar" — no se pidió, y con el modelo de "una foto reemplaza a la
anterior" de este control, en la práctica nunca hay más de una foto
vigente por negocio/producto desde la interfaz. `pickLatestPhoto` es el
único lugar donde el orden importa del lado del cliente: decide cuál
mostrar cuando, por la razón de arriba, llegan a convivir dos.

**Errores**: `getPhotoUploadErrorMessage`/`getPhotoDeleteErrorMessage`
(nuevas, `client/src/lib/api/error-messages.ts`), mismo patrón que el
resto del archivo — el 422 más común no es "archivo muy grande" (eso ya
se atajó en el cliente) sino que el archivo no decodifica como una
imagen real de un formato permitido (regla de seguridad #7).

**Detalle técnico encontrado, no oculto**: `openapi-fetch` tipa el body
de estas dos rutas como `{ file: string }` (openapi-typescript
representa `format: binary` como `string`, correcto para documentación,
no para el tipo real en tiempo de ejecución) — pero SÍ soporta pasar un
`FormData` real como body (su `bodySerializer` por defecto detecta
`body instanceof FormData` y lo manda tal cual, dejando que el navegador
fije `Content-Type`/boundary solo, verificado leyendo
`openapi-fetch/src/index.js` antes de escribir el código). `photos.ts`
usa `body: formData as never` — el escape hatch mínimo para ese
desajuste puntual de tipos, documentado con un comentario en el sitio
exacto, no una forma de saltarse ninguna validación real (esa sigue
siendo enteramente del backend).

### Datos de demo

No hizo falta agregar negocios nuevos — el propósito de esta
funcionalidad es reemplazar fotos ya existentes (las de relleno de
picsum.photos que ya sembraba `seedDemoBusinesses.js` desde la sección
25), así que los 8 negocios y sus ítems de catálogo con foto (Artesanías
Telar Andino) ya eran el escenario de prueba correcto tal cual estaban.

### Verificado con Playwright

Mismo criterio que el resto de las funcionalidades de esta sección del
archivo — script exploratorio contra el servidor real, con MinIO real
(no mockeado, `docker-compose.yml`) y los datos de demo reales,
generando dos JPEG válidos de verdad con `sharp` (no archivos
renombrados) para que la carga pase por la verificación real del
backend:

- Foto principal del negocio: el banner arranca mostrando la foto de
  relleno de picsum.photos → se selecciona un archivo real → aparece la
  vista previa (antes de subir) → "Subir foto" → el banner ya no
  muestra picsum, muestra la foto real recién subida.
- Esa misma foto se ve igual en el perfil público desde una sesión
  anónima aparte (mismo `src` exacto que subió el dueño).
- "Eliminar foto" → el banner vuelve al ícono de respaldo (la olla, para
  una categoría de tipo `food` — ver sección 31), no queda ninguna
  `<img>`.
- Mismo flujo completo (reemplazar y eliminar) para la foto de un
  producto del catálogo (Artesanías Telar Andino), acotando cada
  consulta al `<div>` del producto específico por su nombre — la foto
  propia del negocio y la de cada producto comparten el mismo
  `PhotoUploadControl` en la misma página, así que sin acotar por
  nombre las consultas de "Cambiar foto"/"Eliminar foto" habrían sido
  ambiguas entre el control del negocio y el del producto.
- Los datos de demo se resembraron (`npm run seed:demo`) después de la
  verificación, para dejar las fotos de relleno originales tal como
  estaban antes de la prueba.

### Bug corregido: catálogo de etiquetas de reseñas ya no asume comida

Gap ya documentado explícitamente en la sección 31 ("Las etiquetas
rápidas de reseñas siguen centradas en comida... queda documentado como
pendiente"). El catálogo de 8 etiquetas del rediseño de reseñas (sección
26) nació pensado solo para comida (`hot_food`, `small_portion`...) —
calificar una costurera o una asesoría legal seguía mostrando esas
mismas etiquetas, sin ningún sentido para esos rubros.

**Modelo de datos**: `etiqueta_resena` (ENUM, ver sección 26) solo
admite AGREGAR valores, nunca quitarlos — así que las 8 etiquetas
originales no se tocan (siguen existiendo, siguen siendo válidas para
reseñas ya creadas). Migración `etiquetas-resena-por-tipo-categoria`
agrega 7 valores nuevos. De las 8 originales, 4 resultaron ser
genéricas en realidad (`buen_trato`/`good_service`,
`espera_larga`/`long_wait`, `buen_precio`/`good_price`,
`precio_alto`/`high_price` — nada de eso es específico de comida) y se
reclasifican como tales, mostradas siempre sin importar el rubro; las
otras 4 (`comida_caliente`, `comida_fria`, `buena_presentacion`,
`poca_cantidad`) quedan exclusivas de `alimentos`. Nuevas, para
`productos` (bienes no gastronómicos, ej. artesanías): `buena_calidad`,
`mala_calidad`, `no_como_se_esperaba` (`buena_presentacion`, ya
existente, se reusa también acá — aplica igual de bien al
empaque/acabado de un producto que a un plato). Nuevas, para
`servicios`: `buen_asesoramiento`, `no_resolvio_problema`, `puntual`,
`impuntual`.

**Sin cambios en la validación del backend más allá del enum** —
`resenas.validators.js#REVIEW_TAG_API_VALUES` ya se derivaba
dinámicamente de `business.mapper.js#REVIEW_TAG_API_TO_DB` (no una lista
hardcodeada aparte), así que agregar los mapeos nuevos ahí fue
suficiente para que el validador los acepte — el backend sigue sin
saber ni le importa qué categoría tiene el negocio que se está
calificando; es puramente una decisión del frontend cuáles chips
mostrar.

**Frontend**: `client/src/lib/reviews/review-tags.ts#resolveReviewTags(catalogType)`
devuelve las 4 genéricas + el grupo específico del tipo (`food`/`goods`/
`services`, el mismo `CatalogType` de `catalog-label.ts`, sección 31) —
`business-profile-screen.tsx` ya tenía ese valor calculado (lo usa para
el rótulo del catálogo) y ahora también se lo pasa a `ReviewForm`.
`REVIEW_TAG_LABELS` (textos en español) sigue siendo un solo diccionario
con las 15 etiquetas — `reviews-tab.tsx`/`business-feedback-panel.tsx`
(que solo muestran etiquetas que una reseña YA tiene, sin necesitar
saber el catálogo completo disponible) no necesitaron cambios.

**Verificado**: prueba de integración actualizada
(`tests/unit/resenas.validators.test.js`, ahora espera 15 valores en vez
de 8) y `tsc`/lint del frontend en verde con el nuevo prop
`catalogType` en `ReviewForm`. No se agregó una prueba de Playwright
aparte para esto — el flujo de calificar ya estaba cubierto
manualmente en la verificación de la sección 26, y el cambio acá es
puramente de qué catálogo de chips se muestra, verificable leyendo
`resolveReviewTags` y su prueba unitaria equivalente del lado del
backend (`business.mapper.test.js`, sin cambios necesarios porque no
testea el catálogo completo, solo el mapeo de valores puntuales).

### Gaps conocidos, no ocultos

- **Sin galería de varias fotos por negocio/producto**: el backend sí lo
  permite (ninguna restricción de cantidad), pero `PhotoUploadControl`
  expone deliberadamente un modelo de "una sola foto vigente,
  reemplazable" — coherente con cómo ya se mostraba el perfil antes de
  esta funcionalidad (`.find()`/ahora `pickLatestPhoto`, siempre una
  sola). Construir una galería real (varias fotos, orden elegido a
  mano, carrusel en el perfil) no se pidió y habría sido una
  funcionalidad bastante más grande.
- **Sin barra de progreso de subida real** — `uploading`/`loading` es un
  booleano simple (spinner de texto del `Button` compartido), no un
  porcentaje. No se pidió, y a 8 MB máximo sobre una red razonable no
  hizo falta más para esta primera versión.
- **El borrado de la foto anterior en un reemplazo es best-effort, sin
  reintento automático** — si falla, el negocio queda con dos fotos
  hasta que alguien las borre a mano (la vieja ya no se ve gracias a
  `pickLatestPhoto`, pero sigue ocupando espacio en el bucket). Mismo
  nivel de tolerancia a huérfanos ya aceptado en el resto del proyecto
  para el storage (ver Épica 3, sección 6).
- El asistente de registro de negocio (Épica F5) sigue sin un paso de
  fotos — el vendedor solo puede agregar la foto principal después,
  desde el perfil ya creado. No se pidió agregarlo al asistente, y
  mantenerlo corto (RNF-013) sigue siendo la prioridad de esa pantalla.

## 34. Dos bloqueos de prueba resueltos: verificación de teléfono y propiedad de negocios de prueba

Petición directa del usuario, mientras probaba manualmente QR/sello de
higiene/domicilios en su propio navegador (no parte de ninguna épica) —
propia rama (`chore/desbloqueos-prueba-manual`).

### SKIP_PHONE_VERIFICATION_CHECK (TEMPORAL, SOLO DESARROLLO)

Sin proveedor de SMS conectado en ningún ambiente (sección 21), un
negocio de prueba nunca puede completar el flujo real de OTP — y sin
teléfono verificado, no aparece en `/businesses`, `/businesses/nearby`
ni `/businesses/zones` (regla de seguridad, ver `negocios.repository.js`).
Eso bloqueaba cualquier prueba manual de descubrimiento (mapa, búsqueda,
zonas) contra un negocio recién registrado por la UI real.

- `src/config/env.js`: variable nueva `SKIP_PHONE_VERIFICATION_CHECK`
  (string, default vacío → `false`). Un `.refine()` nuevo hace **fallar
  el arranque completo del proceso** (no lo ignora en silencio) si esta
  variable queda en `'true'` con `NODE_ENV` distinto de `development` —
  no es "se ignora fuera de dev", es "el proceso ni siquiera arranca".
- `negocios.repository.js`: `SALTAR_VERIFICACION_TELEFONO = env.NODE_ENV
  === 'development' && env.SKIP_PHONE_VERIFICATION_CHECK` — vuelve a
  comprobar `NODE_ENV` por su cuenta (defensa en profundidad, no confía
  ciegamente en que el booleano ya "llegó seguro" desde env.js).
  `clausulaTelefonoVerificado()` es el único lugar que decide el
  fragmento SQL real (`'true'` vs. `'n.telefono_verificado = true'`),
  usado en las tres consultas que antes tenían el filtro hardcodeado:
  `listar()`, `construirConsultaCercanos()` y `clusterizar()` (zonas,
  sección 32).
- **La suite de pruebas no depende de esto ni puede verse afectada por
  el valor real de `.env.development`**: `npm test`/`test:unit`/
  `test:integration` ahora fijan `SKIP_PHONE_VERIFICATION_CHECK=` (vacío)
  explícitamente antes de invocar Jest — sin esto, una corrida local con
  la bandera activada en `.env.development` (ver abajo) habría hecho
  fallar la prueba de integración que confirma que un negocio sin
  verificar NO cuenta para una zona (`tests/integration/zonas.test.js`).
  Encontrado corriendo la suite completa después de activar la bandera
  localmente, no anticipado de antemano.
- Pruebas nuevas: `tests/unit/env.skipPhoneVerification.test.js` (parseo
  y el `.refine()` de arranque, con `process.exit`/`console.error`
  mockeados) y un `describe` nuevo en
  `tests/unit/negocios.repository.test.js` (las tres combinaciones de
  `clausulaTelefonoVerificado()`, vía `jest.doMock('../../src/config/env', ...)`
  — `SALTAR_VERIFICACION_TELEFONO` se calcula una sola vez al cargar el
  módulo, así que probarlo exige recargar el módulo fresco con un env
  mockeado distinto en cada caso, mismo patrón que `env.cors.test.js`
  ya usaba para env.js mismo).
- Activada en `.env.development` de este entorno
  (`SKIP_PHONE_VERIFICATION_CHECK=true`, con un comentario que recuerda
  quitarla cuando haya proveedor de SMS real) y documentada en
  `.env.example` con la misma advertencia. **Nunca** copiar este valor a
  `.env.staging`/`.env.production` — el arranque fallaría a propósito.

### Los negocios de prueba NO vienen de registro asistido — investigado, no asumido

Se revisó la base de datos de desarrollo antes de responder, en vez de
asumir. Hallazgo: **ningún** negocio sembrado por `seedDemoBusinesses.js`
ni los negocios propios del usuario vienen de
`POST /auth/assisted-registration`. El único registro genuinamente
asistido en toda la base es una cuenta de prueba vieja y no relacionada
(`donalirio@example.com` / "Fritanga Don Alirio", con el consentimiento
`tipo = 'registro_asistido'` como marca real) — de una verificación
manual anterior, ajena a esta sesión.

La confusión venía de una columna que parece indicar lo contrario pero
no lo hace: `usuarios.contrasena_establecida_en` (migración
`usuarios-registro-asistido`) queda `NULL` quien NO reclamó todavía una
cuenta de registro asistido — pero **también** queda `NULL` en cualquier
cuenta insertada por un `INSERT` directo que no pase por
`usuariosRepo.crear()`/`actualizarContrasena()`, como hace
`scripts/seedDemoBusinesses.js` (nunca la menciona en su lista de
columnas). Esa columna no bloquea login ni autorización — es solo un
campo de auditoría que usa `PATCH /admin/users/{userId}/reissue-claim-token`
para decidir si reemitir un token de reclamo (409 si ya se reclamó). Los
9 negocios de demo y los negocios propios del usuario tienen contraseña
real desde el `INSERT`/registro mismo — inician sesión y matchean
`ownerId` sin ningún paso adicional, tal como se verificó repetidas
veces en las secciones 30-33 de este archivo.

**Negocios propios reales del usuario, encontrados en la base**:
`melendezfer97@gmail.com` (rol `vendedor`, contraseña real, registrado
por la vía normal — no asistida) ya era dueño de dos negocios antes de
esta sesión: "Arepas j" (`01a091e2-b763-79e3-9160-2720a90c7620`) y
"arepas j" (`01a090a6-96fc-735f-b942-80fc44f7b349`, duplicado, mismo
teléfono de contacto). Ambos estaban en `estado = 'pendiente'` (cola de
moderación, RF-019 — un gate distinto e intencional, no relacionado con
la verificación de teléfono) y sin teléfono verificado. Se aprobó
"Arepas j" directo por SQL (`UPDATE negocios SET estado = 'activo'`,
mismo criterio que ya usa `seedDemoBusinesses.js` para saltarse la cola
de moderación en datos de prueba) — con `SKIP_PHONE_VERIFICATION_CHECK`
activo, ya aparece en `/businesses`/`/businesses/nearby`/mapa sin haber
pasado por el OTP. Verificado en vivo contra la API real
(`GET /businesses?q=Arepas%20j`) antes de darlo por resuelto, no solo
razonado.

**Para seguir probando como dueño reconocido**: iniciar sesión con
`melendezfer97@gmail.com` (la contraseña que se usó al registrarse) y
abrir `/negocios/01a091e2-b763-79e3-9160-2720a90c7620` — el QR, el sello
de higiene, "hago domicilios propios" y la carga de fotos (sección 33)
ya deberían verse con los controles de dueño, sin ningún paso de reclamo
de por medio. "arepas j" (el duplicado) queda tal como estaba
(pendiente, sin aprobar) — no se tocó, por si el usuario prefiere
borrarlo a mano en vez de que esta sesión decida por él.

### Gaps conocidos, no ocultos

- La aprobación de "Arepas j" fue manual, por SQL — no existe todavía
  ningún atajo de un clic para "aprobar mi propio negocio de prueba" en
  la interfaz (el flujo real, `POST /admin/businesses/{id}/approve`,
  exige una cuenta de administrador). Coherente con que esto es un
  desbloqueo puntual de esta sesión, no una funcionalidad nueva del
  producto.
- No se investigó ni se tocó a las otras cuentas `administrador` que ya
  existían en la base (`admin-f5@example.com`,
  `phone-admin-1789138959@example.com`, ambas de verificaciones
  anteriores) — sus contraseñas no se conocen desde esta sesión; si el
  usuario quiere probar el flujo real de aprobación/registro asistido
  como administrador, la vía más simple sigue siendo registrar una
  cuenta `administrador` nueva a mano.

## 35. Gestión del catálogo desde el perfil (agregar, editar, eliminar)

Sin épica de frontend asignada hasta ahora — petición directa del
usuario. El backend (Épica 3) ya tenía todo listo
(`POST /businesses/{businessId}/products`, `PATCH`/
`DELETE /products/{productId}`, `ProductInput`: name/price/description/
available) sin ningún cambio necesario acá — esto fue enteramente
construir la UI que faltaba, propia rama
(`feature/gestion-catalogo-frontend`).

### `ProductForm` — un solo componente para crear y editar

`client/src/components/business/product-form.tsx`: mismos 4 campos
(nombre, precio, descripción opcional, disponible) para crear y editar
— `mode` solo cambia el título y el texto del botón de enviar, mismo
criterio que `PhotoUploadControl` siendo un único componente para la
foto del negocio y la de cada producto. Modal como "bottom sheet"
(CLAUDE.md sección 17), calcado del patrón visual exacto de
`AccountDeletionRequestModal`/`ConsentRequiredModal` (overlay
`fixed inset-0`, panel `rounded-t-card`/`rounded-card`). El precio viaja
como texto crudo desde el formulario — la conversión a número y su
validación (`Number.isNaN`, `>= 0`) viven en quien llama
(`business-profile-screen.tsx`), mismo criterio que
`business-registration-wizard.tsx#handleLocationSubmit` con
latitude/longitude.

### Crear/editar vs. eliminar — dos arquitecturas distintas, cada una la que le correspondía

- **Crear y editar** viven en `business-profile-screen.tsx` (el estado
  del formulario — abierto/cerrado, en qué modo, con qué producto —
  necesita conocer tanto "agregar nuevo" como "editar este otro
  producto de la lista", así que naturalmente pertenece a quien
  renderiza la lista completa, no a una fila individual).
- **Eliminar** vive dentro de `product-row.tsx` mismo, self-contained
  (su propio `window.confirm`, su propia llamada a
  `deleteProduct()`, su propio estado de carga/error) — mismo criterio
  ya establecido con `PhotoUploadControl` (sube/borra fotos sin
  necesitar que el padre orqueste nada) y `FavoriteButton` (marca/
  desmarca sin que el padre sepa cómo). Solo notifica al padre
  DESPUÉS de un borrado ya exitoso (`onDeleted(productId)`), para que
  actualice su lista y limpie la entrada de `productPhotos`
  correspondiente.

### "Agregar {ítem}" — el mismo rótulo que ya se adapta por tipo

Botón nuevo junto al título de la sección de catálogo, visible solo
`isOwner`. El texto usa `catalog-label.ts#resolveItemNoun` (nuevo en
ese archivo): "Agregar plato"/"Agregar producto"/"Agregar servicio"
según `Category.type` — mismo criterio exacto que
`resolveCatalogSectionLabel` (sección 31), un solo lugar que ya sabía
traducir el tipo de categoría a texto en español, extendido para el
sustantivo singular en vez de solo el título de la sección.

### Actualiza sin recargar — estado local, mismo patrón que fotos/higiene/QR

`business-profile-screen.tsx` mantiene `products` como estado local
(`useState`, inicializado desde `profile.products`, igual que
`heroPhoto`/`productPhotos` ya hacían) — crear añade al array, editar
reemplaza el elemento con el mismo `id`, eliminar (notificado por
`ProductRow`) lo saca del array. Ninguno de los tres pasa por
`router.refresh()` ni una recarga completa — la lista SIEMPRE se ve
actualizada de inmediato, no depende de volver a pedir el perfil
completo por un cambio en el catálogo.

### "Reemplaza, no acumula" — ya lo cubría el backend, nada nuevo que hacer

El pedido de mantener el mismo criterio que las fotos (sección 33) para
un producto con foto asociada ya estaba resuelto de antes en el
backend: `productos.service.js#eliminar` lista y limpia (best-effort)
las fotos del producto en el bucket ANTES de borrar la fila
(`ON DELETE CASCADE` se encarga de las filas de `fotos`). Lo único que
hacía falta del lado del cliente era no dejar un residuo del lado del
estado en memoria — `handleProductDeleted` en
`business-profile-screen.tsx` también borra la entrada correspondiente
de `productPhotos`, para que un `id` de producto ya eliminado no siga
"recordando" una foto que técnicamente ya no existe en ningún lado.
Editar un producto (PATCH, no crear+borrar) nunca toca la tabla
`fotos` — la foto asociada se conserva sola, sin ninguna lógica extra
necesaria acá.

### Verificado con Playwright

Mismo criterio que el resto de las funcionalidades de esta sección del
archivo — script exploratorio contra el servidor real, con los datos de
demo reales (Artesanías Telar Andino, categoría `productos`; Arepas
Doña Rosa, categoría `alimentos` y catálogo vacío al empezar):

- El botón dice "Agregar producto" en un negocio de bienes y "Agregar
  plato" en uno de comida — mismo rótulo adaptado por tipo que el
  título de la sección.
- Crear un producto nuevo ("Llavero tejido", $15.000) lo muestra en la
  lista sin recargar, con el precio formateado en COP.
- Editarlo (precio → $18.000) abre el formulario ya precargado con los
  valores actuales, y el cambio se refleja en la lista sin recargar —
  los 3 productos sembrados originales siguen intactos.
- Eliminarlo (aceptando el `window.confirm` nativo) lo saca de la lista
  sin recargar.
- Crear el primer plato de un catálogo vacío reemplaza el texto de
  estado vacío por la lista con ese plato.
- Un visitante anónimo no ve el botón de agregar ni los íconos de
  editar/eliminar en ningún producto.
- Los datos de demo se resembraron después de la verificación para
  dejar el catálogo tal como estaba.

### Gaps conocidos, no ocultos

- **Sin campo de categoría del producto** (`ProductInput.categoryId`,
  opcional en el backend) en `ProductForm` — no se pidió, y no hay
  ningún lugar del perfil hoy que use la categoría de un producto
  individual para nada (a diferencia de la categoría del NEGOCIO, que
  sí decide el rótulo del catálogo entero). Queda en `null` para
  productos creados desde esta UI, igual que para los ya sembrados por
  el script de demo.
- **`window.confirm` para la confirmación de borrado**, no un modal
  propio — mismo criterio ya usado en
  `business-registration-wizard.tsx#handleClose` para una confirmación
  de "¿seguro que quieres salir?". Un modal a medida no se pidió y
  hubiera sido más código para una confirmación de una sola pregunta.
- **Sin reordenar productos a mano** — mismo criterio ya documentado en
  la sección 33 sobre el orden de fotos: `orden_visualizacion` existe y
  el backend lo asigna solo, pero no hay ningún endpoint para
  reordenar y no se pidió construir uno. Los productos nuevos se
  agregan al final de la lista (mismo orden que ya devuelve la API).

### Corregido después: agregar la foto de una sola vez al crear

Hueco real, encontrado por el usuario probando el PR ya fusionado: el
modal se cerraba apenas se guardaba el producto nuevo, y
`PhotoUploadControl` solo aparecía dentro de la fila del catálogo — así
que agregarle una foto a un producto recién creado exigía cerrar el
modal, encontrar la fila nueva en la lista, expandirla, y recién ahí
subir la foto. Corregido en la misma rama de esta funcionalidad, no en
una aparte.

`ProductPhotoStep` (nuevo, `client/src/components/business/product-photo-step.tsx`):
un segundo paso del mismo modal, exclusivo del modo "crear" — al
`POST` exitoso, en vez de cerrar, `productForm` pasa a un tercer estado
(`{ mode: "create-photo", product }`) que reemplaza el contenido del
modal por `PhotoUploadControl` (el mismo componente que ya usa la fila
del catálogo) más un botón que dice "Continuar sin foto" o "Listo",
según si ya hay una foto subida en ese momento. **Editar no cambia**:
ahí `PhotoUploadControl` ya vive dentro de la fila expandida del
producto (sección 33), así que este paso extra no aplica ni hacía
falta — el `onSubmit` de edición sigue cerrando el modal directo, igual
que antes de este ajuste.

**Orden deliberado, no accidental**: el producto se crea de verdad en
el backend (`POST`) apenas se confirma el primer paso — lo que queda
pendiente hasta "Listo" es solo reflejarlo en el estado LOCAL
(`products`/`productPhotos`), no la creación en sí. `finishProductCreation()`
vuelca los dos a la vez recién ahí, para que la lista nunca muestre el
producto "a medias" (sin saber todavía si el vendedor le puso foto o
no) mientras el modal sigue abierto encima. Por eso `ProductPhotoStep`
no tiene botón de cerrar/X: en este paso ya no hay nada que
"cancelar" — el producto ya existe — así que la única salida es
"Listo"/"Continuar sin foto".

**Verificado con Playwright**: crear un producto y subirle una foto sin
salir del modal (el botón cambia de "Continuar sin foto" a "Listo" en
cuanto la subida termina); la foto ya se ve en el catálogo apenas se
cierra el modal, sin tener que volver a subirla; "Continuar sin foto"
también funciona para un segundo producto (no es obligatorio subir
nada); editar sigue cerrando el modal directo, sin este paso extra
(regresión verificada explícitamente, no solo asumida).

## 36. Pines del mapa: color por familia de categoría + forma por movilidad

Dos piezas relacionadas del mismo lenguaje visual del mapa, sin RF
asociado — peticiones directas del usuario, dos ramas distintas
(`feature/pines-color-categoria`, luego ajustada en la misma rama; y
`feature/movilidad-negocio`, que depende de la primera).

### Color por familia de categoría (`client/src/lib/map/category-pin-colors.ts`)

Antes: todo pin era el mismo terracota de marca. Primera versión:
`getCategoryPinColor(categoryId)` hasheaba sobre una paleta plana de 8
colores (validada con la skill `dataviz` de este entorno,
`scripts/validate_palette.js`, en modo adyacente). **Ajustada después**
(mismo PR, petición directa del usuario): el color ahora se agrupa
primero por `Category.type` (food/services/goods — mismo `CatalogType`
de `catalog-label.ts`) en tres familias perceptuales, y solo dentro de
cada familia se hashea `categoryId`:

- Cálidos (`food`): `#d9a300` dorado, `#932525` vino, `#d24b4b` coral.
- Azul/morado (`services`): `#2a78d6` azul, `#4a3aa7` violeta.
- Verde (`goods`): `#1baf7a` verde agua, `#008300` verde.

Validado con `--pairs all` (el modo que la propia skill pide para
mapas/scatter, más estricto que el adyacente que usaba la primera
versión): las 7 tonalidades pasan las cuatro comprobaciones medibles,
con un único WARN (no FAIL) en la separación CVD entre aguamarina y
coral — mitigado con el nombre de la categoría como texto al tocar un
pin, igual que antes. **Hallazgo real construyendo esto**: la paleta
plana original (naranja/amarillo/rojo/magenta como "cálidos"
implícitos) falla el piso de visión normal incluso en modo adyacente,
sin importar el orden — los cuatro caen en una banda de matiz
demasiado angosta. La familia cálida final (3 tonos, no 4 — un cuarto
tono cálido que pase junto a los otros tres no existe dentro de un
rango de matiz inequívocamente cálido, buscado por fuerza bruta contra
el validador real) requirió variar luminosidad/saturación mucho más
agresivamente que solo el matiz.

`categoryTypeById` (map-screen.tsx, construido igual que
`categoryNameById` ya existente) se threadea hasta `LeafletMap` — el
color ya no se puede calcular solo con `categoryId`, hace falta saber
también el `type` de esa categoría.

**Verificado con negocios de 2 tipos distintos a la vez** (food +
services) en la misma vista — el seed de demo no tenía una combinación
así fácil de ver sin pelear con el clustering (las 4 categorías no-food
del seed están todas a 30-100m entre sí, se agrupan entre ellas incluso
al zoom máximo de los tiles); se insertó un negocio temporal solo para
la captura de verificación, y se borró después.

### Forma por movilidad autodeclarada (`negocios.movilidad`)

Campo nuevo en `negocios` (migración `movilidad-negocio`): el vendedor
declara si su negocio es "ambulante" (se desplaza) o de "local fijo" —
mismo patrón exacto que `entrega_propia`/`higiene_autodeclarada`:
toggle en el perfil (`MobilityToggle`, segmentado — dos botones, no un
checkbox, porque es una elección entre dos estados excluyentes, ninguno
"apagado" por defecto), solo visible para el dueño, cambia con el mismo
`PATCH /businesses/{businessId}` que ya usa el asistente de registro.

**Nombre elegido a propósito, no `tipo_ubicacion`**: `ubicaciones` ya
tiene una columna `tipo` sobre el ENUM `tipo_ubicacion` (fija | movil |
puesto | local | desde_casa | temporal, ver sección 5) — reusar ese
nombre para un ENUM/columna nuevo y distinto en `negocios` habría
chocado con un tipo de Postgres que ya existe. Se evaluó reusar
directamente `ubicaciones.tipo` (que ya distingue `movil` del resto) en
vez de agregar un campo nuevo, y se descartó: esa columna se llena una
sola vez en el registro (RF-005, un formulario más pesado que
reenviar junto a type/latitude/longitude) — lo pedido acá es un
interruptor independiente, editable en cualquier momento. ENUM nuevo
`movilidad_negocio` (ambulante | local_fijo), columna
`negocios.movilidad`, campo de API `Business.mobility`
(itinerant/fixed) — vocabulario deliberadamente distinto del de
`Location.type` (que también tiene un valor `mobile`), dos campos
relacionados pero no iguales. Default `'ambulante'`/`'itinerant'`,
coherente con el público objetivo original de la plataforma (vendedor
informal de comida callejera, sección 0/1).

**El mapa usa este campo para la FORMA del pin, nunca el color** (el
color sigue viniendo solo de la categoría, sección de arriba):
`local_fijo`/`fixed` mantiene la gota clásica de siempre;
`ambulante`/`itinerant` usa un círculo con un carrito dibujado a mano
en SVG adentro (`createItinerantPinIcon`, leaflet-map.tsx) — ancla al
CENTRO del círculo (mismo criterio que el punto de "mi ubicación"), no
a una punta inferior como la gota, que ese ícono no tiene.
`.f3-business-pin-inner--circle` en globals.css pisa el
`transform-origin` a 50%/50% para que el crecimiento al seleccionar
(sección de la animación de pines, PR anterior) sea concéntrico.

`scripts/seedDemoBusinesses.js`: los 5 negocios de comida quedan
`ambulante`, los 3 no gastronómicos `local_fijo` — excepto Empanadas El
Fogón, marcado `local_fijo` pese a ser comida porque ya estaba aislado
del resto (3km), el punto más claro para comparar a ojo ambas formas
sin pelear con el clustering.

**Verificado con Playwright**: ambas formas renderizando lado a lado
(negocio temporal insertado junto a Empanadas El Fogón, borrado
después) con el color de familia correcto en ambas; el toggle del
perfil cambia el valor, persiste tras recargar, y se probó también la
animación de crecimiento sobre la forma nueva (círculo) sin regresión.

## 37. "Vendiendo ahora" — Fase 1 de 7: `availabilityConfirmedAt` en los listados

Con `negocios.movilidad` ya en `develop` (PR #49), se retoma la mejora
futura de la sección 11 (confirmación de disponibilidad en tiempo
real): reutilizar el backend que ya existía sin usar
(`availability-requests`, `tokens_dispositivo`) más una regla de
visibilidad en el mapa según movilidad. Plan aprobado por el usuario en
7 fases, cada una su propio PR — esta sección documenta la Fase 1.
**Decisión B, explícita del usuario, para la Fase 7 (todavía no
implementada)**: `mobility` nunca oculta ni filtra ningún negocio en
ningún listado — `availabilityConfirmedAt` es puramente informativo
("confirmado hace X"), sin importar si el negocio es `itinerant` o
`fixed`. Esta decisión ya condiciona cómo se implementó esta fase: el
campo se agrega a los listados sin ningún filtro nuevo asociado.

**Qué cambia**: `Business.availabilityConfirmedAt` (antes solo en
`BusinessProfile`, es decir solo en `GET /businesses/{businessId}`)
ahora también viaja en `GET /businesses` y `GET /businesses/nearby` —
`BusinessProfile` ya no redeclara el campo en `openapi.yaml` (allOf
sobre `Business`, quedaría duplicado). `negocios.repository.js#listar`/
`construirConsultaCercanos` agregan un `LEFT JOIN LATERAL` compartido
(`lateralDisponibilidadFresca`) contra `solicitudes_disponibilidad`,
mismo criterio de "fresca" que ya usaba
`solicitudesDisponibilidad.repository.js#obtenerConfirmacionFresca`
para el perfil individual (`AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES`,
60 min). `GET /businesses/zones` queda **sin tocar** en esta fase — es
un agregado por cluster (`businessCount`/`categoryCount`), no tiene
negocios individuales a los que colgarle el campo; se confirmó
explícitamente con el usuario antes de escribir código, no se asumió.

**Hallazgo real al escribir la prueba de plan de ejecución** (mismo
rigor que ya exige `nearbyIndexPlan.test.js` desde la Épica 4): sin
sembrar volumen también en `solicitudes_disponibilidad`, el
planificador resolvía el nuevo `LEFT JOIN LATERAL` con un `Seq Scan`
sobre esa tabla (vacía en la prueba) en vez de
`idx_solicitudes_disponibilidad_confirmadas` — mismo problema, ya
documentado, que ubicaciones/horarios con pocas filas. Se agregó
siembra ahí también. Segundo hallazgo, más sutil: con el volumen ya
sembrado, Postgres eligió correctamente el índice, pero como un
**"Index Only Scan"** (todas las columnas pedidas —`negocio_id`,
`respondida_en`— ya están en el índice, ni toca el heap) — un camino de
acceso por índice más eficiente todavía que `Index Scan`/
`Bitmap Index Scan`, pero que `NODOS_INDEX_SCAN` (el `Set` que la
prueba usa para reconocer "esto es un índice, no un seq scan") no
incluía. Se agregó `'Index Only Scan'` a ese `Set` — no es una
relajación de la prueba, es reconocer un camino de acceso por índice
que ya existía en Postgres y que esta prueba no había necesitado
distinguir hasta ahora.

**Verificado**: suite completa (503/503, incluida una prueba de
integración nueva que crea una confirmación real vía SQL directo y
confirma que `GET /businesses` y `GET /businesses/nearby` la exponen
para ese negocio y `null` para el resto) y en vivo contra el servidor
de desarrollo real con un negocio de demo — el campo aparece con el
timestamp real solo en el negocio confirmado, `null` en los demás,
ningún negocio deja de aparecer.

### Fase 2 de 7: el consumidor pregunta

`AvailabilityRequestButton` (nuevo, `business-profile-screen.tsx`,
visible solo para un consumidor autenticado que no es el dueño) reusa
enteramente el backend de la sección 11 — nada nuevo del lado del
servidor en esta fase. Máquina de estados simple (idle → asking →
pending → confirmed/declined/expired, más un estado de error con
reintento) — mientras está "pending", hace polling cada 5s contra
`GET /availability-requests/{id}` (sin push todavía, Fase 6, pendiente
de credenciales de Firebase — esto es lo único que puede decirle al
consumidor si el vendedor ya respondió). El 409 del backend cubre dos
casos distintos (negocio no activo / vendedor sin notificaciones
habilitadas) con un solo mensaje genérico del lado del cliente, sin
leer el `detail` del servidor — mismo criterio que el resto de
`error-messages.ts`.

`AvailabilityConfirmedBadge` (nuevo, pill verde "Confirmado hace X") es
un componente **separado** del botón — se muestra para cualquiera
(dueño incluido), sin depender de que quien mira haya sido quien
preguntó, porque `availabilityConfirmedAt` ya es público desde la Fase
1. El botón, al confirmar, actualiza este badge en el momento
(`onConfirmed`, mismo patrón `useState` local que `phoneVerified`) sin
depender de recargar la página.

**Verificado con Playwright + curl de punta a punta contra el servidor
de desarrollo real** (no solo con lo que ya prueba la Fase 1): vendedor
y consumidor de prueba registrados por API, negocio activado y con
teléfono verificado por SQL, consentimiento `notificaciones` otorgado
por SQL — el consumidor pide confirmación desde la UI real (botón →
"esperando respuesta…"), el vendedor responde `confirmed` vía
`PATCH .../respond` (simulando lo que la Fase 4 hará desde su propia
UI), y la pantalla del consumidor, sin recargar, pasa a "¡Confirmó que
sigue vendiendo!" más el badge "Confirmado hace instantes" dentro de un
ciclo de polling. Datos de prueba borrados después.

**Gap conocido, no oculto**: solo se verificó en vivo el camino
`pending → confirmed` — `declined`/`expired`/los distintos 409 se
verificaron por lectura de código (misma máquina de estados, mismo
`getAvailabilityRequestErrorMessage`), no con su propia corrida de
Playwright aparte.

### Fase 3 de 7: el vendedor ve y responde (sin push todavía)

**Backend nuevo** (a diferencia de las Fases 1 y 2, que solo reusaban lo
que ya existía): `GET /businesses/{businessId}/availability-requests`
— solo el dueño (autorización a nivel de objeto,
`solicitudesDisponibilidad.service.js#listarPorNegocio`), paginación
keyset (mismo patrón `fechaCreacion+id` que el resto del proyecto).
`status` es un filtro opcional sobre las 4 variantes calculadas de
`AvailabilityRequest.status` — `solicitudesDisponibilidad.repository.js#CLAUSULA_POR_ESTADO`
traduce cada una a SQL: `pending`/`expired` son expiración perezosa
(`decision IS NULL` + comparar `expira_en` contra el reloj, igual que
`toApiRequest()`), `confirmed`/`declined` son `decision` guardada. FIFO
(más antigua primero) — a propósito, al revés del resto de las listas
del proyecto: con solo 10 minutos de vida
(`AVAILABILITY_REQUEST_TTL_MINUTES`), la más antigua es la más urgente
de responder, no la menos relevante.

`VendorAvailabilityRequestsPanel` (nuevo, frontend): pide
`status=pending` cada 8s (más espaciado que el polling del consumidor
de la Fase 2, 5s — acá nadie está esperando en el momento, es solo
"avisarme si llegó algo nuevo mientras tengo mi perfil abierto") y
ofrece Confirmar/Declinar por fila (`PATCH .../respond`, ya existía
desde la sección 11). **Anonimizado a propósito**, mismo criterio que
`BusinessFeedbackPanel`: el backend no expone quién preguntó a través
de ningún endpoint público, así que cada fila solo puede decir "hace
cuánto" (`formatAskedAgo`), nunca quién. Al confirmar, actualiza el
mismo estado local `availabilityConfirmedAt` que ya usa el badge de la
Fase 2 (`onConfirmed`) — el dueño ve su propio badge actualizarse en el
acto, sin recargar.

Esto **cierra el círculo completo sin depender de Firebase**: antes de
esta fase, "vendiendo ahora" solo podía completarse simulando la
respuesta del vendedor por API a mano (como se hizo para verificar la
Fase 2). Desde ahora, un vendedor real puede responder abriendo su
propio perfil — el push (Fase 6) queda como mejora de conveniencia
(avisar sin tener que abrir la app), no como requisito para que la
función funcione de punta a punta.

**Verificado**: 9 pruebas de integración nuevas (FIFO, filtro por cada
uno de los 4 `status`, sin filtro, paginación keyset, 403/404/422/401)
— suite completa 512/512. En vivo con Playwright contra el servidor de
desarrollo real: vendedor y consumidor de prueba por API, el consumidor
pregunta, el vendedor abre su propio perfil y ve "Te preguntan si
sigues vendiendo" (el panel apareció solo con el polling, sin recargar
la página), toca "Confirmar" — el panel desaparece y el badge
"Confirmado hace instantes" aparece en el mismo instante. Datos de
prueba borrados después.

### Fase 4 de 7: UI de consentimiento de notificaciones

Sin backend nuevo — `POST /consents` ya existía completo desde la
Épica 8 (RF-018), pero nada en el frontend lo llamaba para
`tipo_consentimiento='notifications'` (solo los dos obligatorios, al
registrarse/loguearse, y `assisted_registration`, del lado del
servidor). Sin esto, ningún vendedor real podía completar la Fase 1
de esta mejora futura — `solicitar()` (sección 11) rechaza con 409 sin
este consentimiento, así que un vendedor recién registrado nunca podía
recibir una pregunta real, aunque las Fases 1-3 ya funcionaran de
punta a punta.

**Dónde vive, y por qué ahí**: `SettingsTab` (`/perfil`, pestaña
Configuración) — no en el perfil de negocio. El consentimiento es
`usuario_id`-scoped, no por negocio (`solicitar()` lo verifica contra
`negocio.usuario_id`, sin filtrar por `businessId`), así que cubre
todos los negocios de un mismo vendedor a la vez — corresponde a un
ajuste de cuenta, no a un negocio en particular. Esto **rompe a
propósito** el criterio "de solo lectura" que `SettingsTab` traía
documentado desde la Épica F6 (`GET /users/me/consents`, sin ninguna
acción): hasta ahora no existía ningún consentimiento opcional con una
acción real que tuviera sentido ofrecer desde ahí; `notifications` es
el primero.

`grantNotificationsConsent()` (nuevo, `lib/api/consents.ts`) — a
diferencia de `grantMandatoryConsents()` (best-effort, silencioso, ya
existente), esta sí muestra el resultado: es una acción explícita del
vendedor, no un paso automático después de un formulario. El botón
"Activar notificaciones" solo se muestra si `notifications` todavía no
está en la lista de consentimientos ya otorgados — al confirmar, se
agrega al estado local (mismo criterio que el resto de esta sección:
sin recargar la página, sin volver a pedir `GET /users/me/consents`).

**Verificado con Playwright + curl contra el servidor de desarrollo
real**: vendedor de prueba con solo los dos consentimientos
obligatorios (sin `notifications`) → `/perfil` → Configuración muestra
"Preguntas de disponibilidad" con el botón → al tocarlo, el botón
desaparece y "Notificaciones" aparece en la lista de otorgados, sin
recargar. Verificado además que esto desbloquea el flujo real: un
consumidor preguntando por un negocio de ese mismo vendedor, que antes
del consentimiento hubiera dado 409, da **201** después de otorgarlo.
Datos de prueba borrados después.

### Fase 7 (saltando la 6, push/Firebase — pendiente de credenciales): decisión B, la regla de visibilidad

Se saltó a propósito la Fase 6 (push real, requiere que el usuario
aporte credenciales de un proyecto Firebase — Web app config + clave
VAPID, todavía sin conseguir) para cerrar primero esta, que no depende
de eso.

**La "regla" en sí ya estaba resuelta desde la Fase 1, sin que hiciera
falta escribir nada nuevo**: se auditó `negocios.repository.js`
(`listar`/`construirConsultaCercanos`/`clusterizar`) buscando
`movilidad` en cualquier cláusula `WHERE` — no aparece en ninguna,
solo en `INSERT`/`UPDATE` (creación/edición del negocio). Nunca hubo
un filtro que quitar: la decisión B (ambulante y local fijo se ven
siempre igual, `availabilityConfirmedAt` es solo una insignia,
"nunca oculta ni filtra ningún negocio") ya era el comportamiento real
del código, no algo pendiente de implementar. Lo que sí faltaba,
y es lo que entra en esta fase:

1. **Prueba de regresión que fija la decisión** (`discovery.test.js`,
   nueva `describe`): 4 negocios (ambulante/local fijo × confirmado/sin
   confirmar) — confirma que los 4 aparecen en `GET /businesses` y que
   el orden (`fecha_creacion DESC`) no cambia por tener una
   confirmación fresca. Sin esta prueba, un cambio futuro que agregara
   sin querer un filtro o un `ORDER BY` que privilegie lo confirmado
   pasaría desapercibido — ahora hay algo que lo detiene.
2. **`AvailabilityConfirmedBadge` (Fase 2) ahora también en
   `BusinessCard`** — hasta esta fase, la insignia solo vivía en el
   perfil completo del negocio (`business-profile-screen.tsx`). Como
   `BusinessCard` es el componente que ya comparten Inicio/Buscar, el
   mapa (`BusinessSummarySheet`) y Favoritos, agregarla ahí una sola
   vez la muestra en los tres listados a la vez — exactamente lo que
   pedía la decisión B ("se muestra el dato... en todos los listados y
   en el mapa"), sin tocar esas tres pantallas por separado.
3. **Hallazgo real al verificar Favoritos**: `favoritos.repository.js#listar`
   nunca tuvo el `LEFT JOIN LATERAL` contra `solicitudes_disponibilidad`
   que sí tenían `listar()`/`cercanos()` desde la Fase 1 —
   `GET /users/me/favorites` seguía devolviendo `availabilityConfirmedAt: null`
   siempre, aunque el negocio sí tuviera una confirmación fresca (verificado
   primero con un curl real que lo mostró en `null`, antes de escribir el
   fix). Agregado el mismo LATERAL (duplicado a propósito, no
   importado de `negocios.repository.js` — cada repositorio de este
   proyecto es autosuficiente) + una prueba de integración nueva en
   `favoritos.test.js`. `GET /businesses/zones` sigue sin este campo,
   sin cambios — decisión ya tomada en la Fase 1 (agregado por cluster,
   sin negocios individuales).

**Verificado**: 2 pruebas de integración nuevas — suite completa
514/514. En vivo contra el servidor de desarrollo real: la insignia
"Confirmado hace X min" aparece en la lista "Cerca de ti" de `/buscar`
para el negocio de demo con una confirmación insertada a mano, y ningún
otro negocio se oculta ni cambia de posición. `GET /users/me/favorites`
confirmado por curl devolviendo el timestamp real después del fix (antes
del fix, con el backend ya reiniciado, daba `null` — se verificó el bug
real antes de corregirlo, no se asumió). Datos de prueba borrados
después.

## 38. Pantalla de inicio (`/`) por rol

Petición directa del usuario, sin RF asociado — un consumidor (o
administrador) sigue viendo el mapa en `/` exactamente igual que desde
el PR #41. Un vendedor con exactamente un negocio **activo** aterriza
directo en su propio perfil (`/negocios/{id}`) en vez del mapa.

### Decisiones tomadas con el usuario antes de escribir código

Tres preguntas reales, no asumidas — CLAUDE.md/el código no tenían
ninguna respuesta ya dada para ellas:

1. **Vendedor con más de un negocio** (caso real, no hipotético — ver
   sección 34, la cuenta con "Arepas j"/"arepas j" duplicados): se
   muestra un selector simple ("¿Cuál de tus negocios quieres ver?"),
   no se adivina cuál mostrar.
2. **Solo cuenta `status = 'active'`** para decidir "el vendedor tiene
   negocio" — uno `pending`/`rejected`/`suspended`/`closed` no redirige
   ni cuenta para el selector. Mandarlo a `/negocios/nuevo` en ese caso
   habría empujado a crear un segundo negocio sobre uno que ya existe
   (justo el problema ya documentado en la sección 34) — en vez de eso,
   sin ningún negocio activo, se queda en el mapa, igual que un
   consumidor. El link "Registrar negocio" de `AppHeader` sigue ahí sin
   cambios para quien todavía no tiene ninguno.
3. **Efecto secundario real, encontrado al planear, no al implementar**:
   `BottomNavBar` tenía el destino "Mapa" apuntando a `href: "/"` — si
   `/` deja de ser el mapa para un vendedor, tocar "Mapa" en la barra lo
   devolvía a su propio perfil de negocio, sin ninguna forma de llegar
   al mapa desde la navegación principal. Se resolvió devolviéndole a
   `/mapa` su propósito original (antes del PR #41, ese archivo era
   `redirect("/")` "por si algo externo apuntaba ahí" — ahora vuelve a
   renderizar `MapScreen` de verdad) y apuntando "Mapa" ahí en vez de
   `/`.

### Qué faltaba para poder construir esto: no existía ninguna forma de listar "mis negocios"

Hallazgo real al investigar, antes de escribir código: ni `GET
/businesses` acepta un filtro `ownerId` (solo `categoryId`/`q`/
`priceMin`/`priceMax`/`openNow`), ni existía ningún `/users/me/*`
equivalente — el único lugar que "sabía" el id de un negocio recién
creado era el propio asistente de registro, que lo tiene en la mano
justo después del `POST /businesses` y nunca necesitó volver a
buscarlo.

`GET /users/me/businesses` (nuevo): autenticado, cualquier estado (a
diferencia de `listar()`/`cercanos()`, que solo devuelven `'activo'` y
con teléfono verificado — acá es el propio dueño mirando lo suyo,
mismo criterio que `GET /businesses/{businessId}` con el dueño real).
Mismo patrón exacto que `/users/me/favorites`: repositorio
(`negocios.repository.js#listarPorUsuario`, sin el `LEFT JOIN LATERAL`
de disponibilidad — no hace falta para decidir a dónde redirigir),
servicio (reusa `armarPagina`/`decodificarCursor` ya existentes en
`negocios.service.js`), controlador, ruta, `openapi.yaml`.

### Frontend

`HomeScreenRouter` (nuevo, `client/src/components/discovery/`) — vive
detrás de `RequireAuth`, reemplaza el contenido que tenía `page.tsx`.
Sin vendedor, o vendedor con cero negocios activos: el mismo `<main>`
con `AppHeader`/`MapScreen`/`BottomNavBar` de siempre — ni un
milisegundo de fetch de más para un consumidor. Con exactamente uno:
`router.replace()` a su perfil (con un estado "Buscando tu negocio…"
mientras se resuelve, mismo lenguaje visual que `RequireAuth`). Con más
de uno: `VendorBusinessPicker`, una lista simple sin paginación (los
casos reales son 1-2 negocios, nunca cientos) — sin mostrar el estado
en cada fila, porque ya están filtrados a `active`, siempre sería el
mismo texto.

`client/src/app/mapa/page.tsx` recupera el contenido que tenía
`page.tsx` antes de este cambio. `BottomNavBar`: "Mapa" pasa a apuntar
a `/mapa`; el chequeo de "pestaña activa" trata `/` y `/mapa` como el
mismo destino (así un consumidor viendo el mapa en `/` sigue viendo
"Mapa" resaltado en la barra, sin importar cuál de las dos rutas sirvió
la página).

### Verificado con Playwright + curl contra el servidor de desarrollo real

Cuatro escenarios reales, no solo el camino feliz obvio: vendedor de
demo con un negocio activo → aterriza en su perfil; vendedor de prueba
con dos negocios activos (creados por API para esto) → selector con
los dos nombres; consumidor recién registrado por la UI real →
`/` sigue siendo el mapa; y navegar a `/mapa` directamente (equivalente
a tocar "Mapa" en la barra) desde la sesión de un vendedor ya redirigido
a su perfil → el mapa real, confirmando que no perdió acceso. Suite
completa del backend: 517/517 (3 pruebas nuevas). Datos de prueba
borrados después.

### Gaps conocidos, no ocultos

- El selector (`VendorBusinessPicker`) no muestra categoría ni foto de
  cada negocio, solo el nombre — no se pidió, y en la práctica el caso
  de 2+ negocios activos es raro (un vendedor real normalmente tiene
  uno). Agregar más contexto ahí es una mejora razonable a futuro, no
  construida acá.
- `AppHeader` sigue mostrando "Registrar negocio" a cualquier vendedor
  sin importar si ya tiene uno activo — no se pidió cambiar ese link en
  esta funcionalidad.

## 39. Recuperación de contraseña — UI (RF-003)

Sin backend nuevo — `POST /auth/forgot-password`/`POST /auth/reset-password`
ya existían completos desde la Épica 1 (CLAUDE.md sección 10), sin
ningún consumidor en el frontend hasta ahora. Petición directa del
usuario, junto con el punto de la sección 40 (cambio de contraseña
logueado) — planeados juntos, implementados en PRs separados porque uno
es puro frontend y el otro necesita un endpoint nuevo.

`/recuperar-contrasena` (pide el enlace) y `/restablecer-contrasena`
(lo completa, leyendo `?token=` de la URL — mismo nombre de parámetro
que espera el backend) — las dos bajo el grupo `(auth)`, mismo layout
centrado que login/registro. Enlace "¿Olvidaste tu contraseña?" nuevo
en `/login`, debajo del campo de contraseña.

**Mismo mensaje de éxito exista o no la cuenta** (RF-003, no permite
enumerar usuarios) — `requestPasswordReset()` nunca distingue "correo
no encontrado" de "listo", y la pantalla tampoco: si la petición
responde `202`, siempre muestra "revisa tu correo".

**Sin proveedor de correo elegido todavía** (gap ya documentado) — el
token se registra en el log estructurado del backend en vez de
enviarse por correo real. Se verificó el flujo completo igual,
sacando el token del log de `pm2` a mano: pedir el enlace → confirmar
el mensaje de éxito → completar con el token real → **iniciar sesión
con la contraseña nueva de verdad funcionó** (no solo "la pantalla dijo
que funcionó"). También se verificó `/restablecer-contrasena` sin
`?token=` en la URL (enlace abierto mal, o copiado incompleto): aviso
claro, sin llegar a mostrar el formulario. Cuenta de prueba borrada
después.

`useSearchParams()` (para leer el token) exige un límite `Suspense` en
Next.js — el formulario real vive en un componente separado
(`RestablecerForm`) solo por eso, envuelto en `<Suspense>` desde la
página; verificado que `npm run build` prerenderiza la ruta sin avisos.

### Pendiente, sin resolver en esta rama (ver sección 40)

Cambiar la contraseña **estando logueado** no reusa este flujo — pedir
un enlace por correo para algo que ya se puede probar con la
contraseña actual sería peor experiencia, y en desarrollo obligaría a
revisar el log del servidor. Queda como un endpoint nuevo aparte.

## 40. Cambiar contraseña estando logueado

Segunda pieza de la funcionalidad de contraseña (ver sección 39) —
planeadas juntas, implementadas en PRs separados porque esta necesita
backend nuevo y la otra no. Decisión tomada con el usuario antes de
escribir código: **no reusar** el flujo de recuperación por correo
(`/auth/forgot-password`/`reset-password`) para esto — pedir un
enlace por correo para algo que ya se puede probar con la contraseña
actual sería peor experiencia, y sin proveedor de correo elegido
todavía, obligaría a revisar el log del servidor en vez de cambiarla
al instante.

### Backend (nuevo)

`POST /users/me/change-password` (`currentPassword`+`newPassword`) —
`authService.changePassword()`, junto a `login()`/`register()`/
`refresh()` (no en `passwordReset.service.js`: esa es la lógica del
flujo con token, esta verifica la contraseña actual con
`argon2.verify`, mismo patrón exacto que `login()` pero sin el
`DUMMY_HASH` anti-enumeración — acá el usuario ya está autenticado, no
hay nada que enumerar). Cambiar la contraseña revoca todas las
sesiones existentes (`tokensRefrescoRepo.revocarTodosDeUsuario`, mismo
criterio que `restablecerContrasena()`) — **incluida la que hizo la
propia petición** — por eso la respuesta (`200`) trae un `AuthTokens`
nuevo (`emitirTokens()`, reusada tal cual), para que ese mismo
dispositivo no tenga que volver a iniciar sesión.

### Frontend

`SettingsTab` gana una sección "Contraseña" (nueva, entre "Tu cuenta"
y "Consentimientos otorgados") — actual/nueva/repetir, validación de
longitud/coincidencia del lado del cliente antes de llamar al backend.
`AuthContextValue` gana `applyNewTokens` (nuevo, wrapper público sobre
el `applySessionAndFetchUser` que ya usan `login()`/`register()`
internamente) — sin esto, la sesión de la propia pestaña habría
quedado "cerrada" (access token viejo, sin refresh token válido)
justo después de la acción que la cerró, aunque el usuario nunca
tocó "Cerrar sesión".

### Verificado con Playwright + curl contra el servidor de desarrollo real

No solo el mensaje de éxito en pantalla: cambié la contraseña desde
Configuración con una cuenta de prueba real, **recargué la página** (la
sesión siguió viva, sin redirigir a `/login`) y confirmé por `curl`
directo contra el backend que la contraseña nueva da `200` en
`POST /auth/login` y la vieja da `401` — el cambio real ocurrió, no
solo la UI lo dijo. 8 pruebas de integración nuevas (`passwordReset.test.js`,
junto al flujo de recuperación): cambio exitoso + login con la nueva,
revocación de la sesión vieja (`refreshToken` anterior ya no sirve
para `/auth/refresh`), 401 con la contraseña actual incorrecta (y que
ese intento fallido no toca la contraseña real), 401 sin token, 422
con una contraseña nueva corta. Suite completa del backend: 522/522.
Cuenta de prueba borrada después.

## 41. `PATCH /users/me` — editar nombre y celular

Sin RF asociado — el endpoint ya estaba declarado completo en
`openapi.yaml` desde antes (`fullName`/`phone`/`profilePhotoUrl`) pero
nunca tuvo ruta ni implementación, mismo tipo de gap que
`DELETE /users/me` (sección 23) salvo que acá sí tenía sentido
completarlo tal cual. Propia rama (`feature/editar-perfil-usuario`).

**Alcance deliberadamente recortado**: solo `fullName`/`phone` —
`profilePhotoUrl` queda declarado en el contrato pero sin implementar
(nota agregada en `openapi.yaml` explicando por qué): no existe ningún
pipeline de subida de foto de perfil de **usuario** (distinto de fotos
de negocio/producto, Épica 3) — construirlo hubiera sido una
funcionalidad bastante más grande que "editar el celular", que es lo
que se pidió.

### Dónde vive la lógica — sin `usuarios.service.js` nuevo

A diferencia de la mayoría de los dominios de este proyecto, `usuarios`
nunca tuvo una capa de servicio propia — `me()` (Épica 1) ya llamaba a
`usuariosRepo.buscarPorId` directo desde el controlador, sin nada en
medio. Se mantuvo ese mismo criterio en vez de introducir un archivo
nuevo solo para esta funcionalidad: `usersController.updateMe` resuelve
el merge "campo omitido conserva el valor existente" (trae el usuario
actual, sustituye solo lo que vino en el body) y llama directo a
`usuariosRepo.actualizar(id, {...})` con los valores ya finales — mismo
principio que `negocios.service.js#actualizar` con un PATCH parcial,
solo que acá el "service" es el propio controlador por lo liviano que
es. `src/validators/usuarios.validators.js` (nuevo, siguiendo la
convención de un archivo de validadores por dominio, no metido dentro
de `auth.validators.js`) exige al menos uno de los dos campos —
un body vacío es 422, no un no-op silencioso.

### Verificado con la suite completa + en vivo

`tests/integration/users.test.js` (nuevo — no existía ningún archivo de
pruebas para `usuarios` fuera de auth/password): actualizar los dos
campos juntos, actualizar solo uno y confirmar que el otro se conserva
(los dos sentidos), 422 con body vacío, 422 con `fullName` vacío, 401
sin token. Suite completa del backend: 528/528. Verificado además con
`curl` directo contra el backend real (cuenta de demo
`demo-arepas-dona-rosa@ruteando.test`) y con Playwright contra el
frontend real (`SettingsTab`, cuenta `demo-perros-el-parche@ruteando.test`):
edición → mensaje de confirmación → **recarga real de la página**
(confirma que el backend quedó actualizado, no solo el estado en
memoria) → validación del lado del cliente bloqueando un nombre vacío
→ datos de la cuenta de demo restaurados a como estaban al terminar.

### Frontend

`SettingsTab` — la sección "Tu cuenta" (antes de solo lectura) pasó a
ser un formulario (`updateProfile()`, `client/src/lib/api/update-profile.ts`)
con los mismos dos campos; correo y tipo de cuenta siguen debajo, de
solo lectura, sin endpoint para cambiarlos. `AuthContextValue` ganó
`updateUser(user)` (nuevo, junto a `applyNewTokens`) — a diferencia de
cambiar la contraseña, `PATCH /users/me` no rota tokens, así que no
hacía falta re-emitir sesión: solo reflejar el `User` ya devuelto por
la respuesta en el estado en memoria, sin un `GET /users/me` adicional.
