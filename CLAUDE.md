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
| `busqueda` | Al ejecutar una búsqueda por texto o categoría (Épica F2) |
| `vista_negocio` | Al abrir el perfil completo de un negocio (Épica F4) |
| `vista_producto` | Al expandir el detalle de un producto en el menú (Épica F4) |
| `clic_contacto` | Al tocar el botón de WhatsApp en el perfil (Épica F4) |
| `favorito_agregado` | Al marcar un negocio como favorito (Épica F8) |
| `resena_creada` | Al publicar una reseña (Épica F7) |
| `registro_negocio` | Al completar el registro de un negocio (Épica F5) |

## 17. Patrón de interacción — mínimo scroll, expandir en el mismo lugar

Decisión de diseño explícita (extiende Documento 08, sección 5.4): antes de
crear una pantalla nueva o una navegación adicional para mostrar más
información, preferir que el contenido se expanda en el mismo lugar
(acordeón, "bottom sheet", tarjeta que crece) — el Documento 08 ya aplica
esto en la tarjeta resumen del mapa (sección 5.4.2); se extiende a:

- **Menú del negocio**: cada plato se expande al tocarlo (foto grande,
  descripción completa) sin navegar a otra pantalla.
- **Inicio**: una tarjeta de negocio se despliega in-place para mostrar
  horario/reseñas rápidas, en vez de abrir el perfil completo salvo que el
  usuario pida "ver perfil completo".
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
  búsqueda, skeleton screens mientras carga.
- **Épica F3 — Mapa**: pines agrupados, tarjeta resumen expandible in-place,
  filtros combinables (distancia, precio, abierto ahora).
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
