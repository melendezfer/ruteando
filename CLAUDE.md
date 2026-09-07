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
- El plan de pruebas no incluye pruebas de carga/estrés — agregarlas para
  la Épica 4 como mínimo.
- El trabajo de campo con vendedores y consumidores reales de Ciudad Verde
  todavía no se ha ejecutado — los supuestos de UX (Documento 08) están
  bien fundamentados en la literatura pero no en entrevistas propias
  completas; si durante el desarrollo surge evidencia que los contradiga,
  el código puede necesitar ajustarse y **debe documentarse el cambio**, no
  solo aplicarse en silencio.
