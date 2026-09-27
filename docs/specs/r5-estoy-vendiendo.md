# R5 — "Estoy vendiendo ahora" (confirmación propia del vendedor)

Versión 0.2 · 2026-09-27 · Estado: **implementada en `feature/r5-estoy-vendiendo`, pendiente de prueba manual** (guía: `docs/pruebas/r5-prueba-manual.md`)

> **Cambios v0.2 (implementación):** decisiones DP-1 a DP-10 aplicadas tal como se propusieron, con la regla del usuario "el aviso más reciente manda" (respuesta a una pregunta o aviso propio; "no" o "ya no estoy vendiendo" quita el "vendiendo ahora" de inmediato). Tres ajustes respecto de la v0.1, marcados **[v0.2]** en el texto: la hipótesis de la sección 2 quedó confirmada; el índice viejo de confirmaciones se reemplazó; y el campo `sellingNow` solo para el dueño (5.6) se descartó.

Origen: prerrequisito R5 de `docs/integracion-ancla.md` (v0.3), decisiones DI-06 (ícono `SealCheck`) y DI-07 (la función existe sin el ancla; la confirmación propia cuenta igual que responder una pregunta en `availabilityConfirmedAt`, con la misma frescura de 60 min). Sin RF asociado: extiende la "confirmación de disponibilidad en tiempo real" (CLAUDE.md §11 y §37).

> Lo que este documento afirma sobre el código actual se revisó leyendo `develop` en el commit `67a6d23` (2026-09-27). Lo que no se probó con la app corriendo o con una prueba automatizada va marcado como **hipótesis sin verificar**.

---

## 1. Problema

Hoy el "confirmado hace X" (`availabilityConfirmedAt`) solo nace cuando un consumidor pregunta y el vendedor responde "sí" (`PATCH /availability-requests/{id}/respond`). El vendedor no puede avisar por su cuenta que salió a vender. En la práctica:

- Un vendedor que acaba de abrir no tiene cómo destacarse hasta que alguien le pregunte.
- Las preguntas requieren que el vendedor haya aceptado notificaciones y que un consumidor con sesión pregunte primero, así que la mayoría de los negocios nunca llega a mostrar "Vendiendo ahora".
- El dato más valioso de la plataforma (¿está vendiendo de verdad?) depende de un paso que el vendedor no controla.

## 2. Estado actual (verificado leyendo el código)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Tabla `solicitudes_disponibilidad` | migración `disponibilidad-tiempo-real` | Una fila por pregunta: `negocio_id`, `usuario_id` (quien pregunta, `NOT NULL`), `expira_en` (10 min), `decision` (`confirmada`/`rechazada`), `respondida_en`. Índice parcial `idx_solicitudes_disponibilidad_confirmadas (negocio_id, respondida_en) WHERE decision = 'confirmada'` |
| Frescura | `negocios.repository.js#lateralDisponibilidadFresca`, `favoritos.repository.js`, `solicitudesDisponibilidad.repository.js#obtenerConfirmacionFresca` | La última fila `confirmada` con `respondida_en` de hace menos de `AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES` (60). Tres copias de la misma consulta |
| Responder | `solicitudesDisponibilidad.service.js#responder` | Solo el dueño, solo si la pregunta sigue pendiente. No mira el horario |
| Mostrar | `AvailabilityConfirmedBadge` (perfil y `BusinessCard`), `DiscoveryRow` ("Vendiendo ahora" vs. "Abierto"), orden de "Disponibles ahora" (`sortAvailableNow`) | Todo lee solo `availabilityConfirmedAt` |
| Ícono | `SEMANTIC_ICONS.confirmedSelling = SealCheck` | Ya significa "el vendedor confirmó que está vendiendo" |
| Ubicación en vivo | `POST /businesses/{id}/live-location` | Proactiva, pero solo para ambulantes, y **no** toca `availabilityConfirmedAt` |

**[v0.2] Confirmado con una prueba** (antes era hipótesis sin verificar): como la frescura busca "la última fila `confirmada`" e ignora las `rechazada`, si un vendedor responde "sí" a las 10:00 y "no" a una segunda pregunta a las 10:20, el negocio seguiría mostrando "Vendiendo ahora" hasta las 11:00. La prueba `un "no" posterior apaga un "sí" anterior todavía fresco` (`tests/integration/availabilityRequests.test.js`) falló contra el código anterior (devolvía la fecha del "sí") y pasa con R5 (RF-R5-6).

## 3. Historias de usuario

- **HU-1 (vendedor):** como vendedor, cuando salgo a vender quiero tocar "Estoy vendiendo ahora" para que los clientes cercanos sepan que estoy, sin esperar a que alguien me pregunte.
- **HU-2 (vendedor):** como vendedor, si sigo vendiendo después de un rato quiero renovar el aviso con un toque, para que no se venza a mitad de la jornada.
- **HU-3 (vendedor):** como vendedor, cuando me voy o se me acaba todo quiero tocar "Ya no estoy vendiendo" para que nadie camine hasta mi puesto en vano.
- **HU-4 (vendedor):** como vendedor quiero ver cuánto le queda al aviso, para saber cuándo renovarlo.
- **HU-5 (consumidor):** como consumidor quiero ver "Vendiendo ahora · confirmado hace X" en el mapa, la búsqueda y el perfil, igual que cuando alguien preguntó, sin tener que distinguir de dónde salió el dato.
- **HU-6 (consumidor):** como consumidor quiero que un aviso viejo no me engañe: pasados 60 minutos sin renovar, desaparece solo.
- **HU-7 (plataforma):** como equipo de RUTEANDO quiero que un vendedor no pueda dejar el aviso "encendido para siempre" ni usarlo para saltarse los filtros de visibilidad.

## 4. Requisitos

### Funcionales

| ID | Requisito |
|---|---|
| RF-R5-1 | El dueño de un negocio `activo` puede confirmar que está vendiendo ahora. |
| RF-R5-2 | La confirmación propia alimenta el mismo `availabilityConfirmedAt` que responder una pregunta (DI-07), en todos los lugares donde ya se expone: `GET /businesses`, `/businesses/nearby`, `/businesses/{id}`, `/users/me/favorites`. |
| RF-R5-3 | Vence sola a los 60 minutos (`AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES`), sin cron: se calcula al leer, como el resto del proyecto. |
| RF-R5-4 | Confirmar de nuevo renueva el plazo (nuevos 60 minutos desde ese momento). |
| RF-R5-5 | El dueño puede terminar el aviso antes de tiempo ("Ya no estoy vendiendo"). Desde ese momento `availabilityConfirmedAt` es `null`, aunque haya una confirmación anterior todavía dentro de los 60 min. |
| RF-R5-6 | Manda la **última señal** del vendedor, venga de donde venga: confirmar propio, dejar de vender, responder "sí" o responder "no" a una pregunta. |
| RF-R5-7 | Funciona con la interfaz normal, sin el ancla (principio 1 y DI-07). |

### No funcionales

| ID | Requisito |
|---|---|
| RNF-R5-1 | Sin pérdida de rendimiento medible en `/businesses/nearby`: la prueba del plan de ejecución sigue sin seq scans sobre tablas grandes, y la prueba de carga k6 sigue dentro de p95 < 300 ms. |
| RNF-R5-2 | Una sola fuente de verdad para "frescura": una función SQL compartida, no cuatro copias de la consulta. |
| RNF-R5-3 | Errores en RFC 9457. |
| RNF-R5-4 | El botón es usable con una mano y con baja familiaridad digital (persona "Don Alirio"): un toque, texto claro, sin formularios. |

## 5. Cambios de backend

### 5.1 Modelo de datos (migración nueva, `confirmaciones-venta-propia`)

Tabla nueva en vez de reusar `solicitudes_disponibilidad`: esa tabla modela una **pregunta** de un consumidor (`usuario_id` es quien pregunta, con `expira_en` de 10 min), y meter ahí confirmaciones sin pregunta obligaría a filas con campos que no significan lo mismo.

```sql
CREATE TYPE senal_venta AS ENUM ('vendiendo', 'dejo_de_vender');

CREATE TABLE senales_venta (
  id             UUID PRIMARY KEY DEFAULT uuidv7(),
  negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL, -- el dueño que la dio (auditoría)
  senal          senal_venta NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_senales_venta_negocio ON senales_venta(negocio_id, fecha_creacion DESC);
```

Sin columna de vencimiento: igual que hoy, "fresca" se calcula comparando `fecha_creacion` contra el reloj.

### 5.2 Regla de frescura unificada (RF-R5-6)

Una sola expresión SQL compartida (reemplaza a `lateralDisponibilidadFresca`, a la copia de `favoritos.repository.js` y a `obtenerConfirmacionFresca`):

1. Tomar la **última señal** del negocio entre: filas de `senales_venta` y respuestas de `solicitudes_disponibilidad` (`confirmada` → vendiendo, `rechazada` → dejó de vender, con `respondida_en` como fecha).
2. Si esa última señal es "vendiendo" y tiene menos de 60 minutos → `availabilityConfirmedAt` = su fecha.
3. En cualquier otro caso → `null`.

Ambas fuentes se leen con índice (`idx_senales_venta_negocio` y un índice parcial nuevo sobre `solicitudes_disponibilidad (negocio_id, respondida_en) WHERE decision IS NOT NULL`, porque el actual solo cubre `confirmada`). **[v0.2]** El índice viejo `idx_solicitudes_disponibilidad_confirmadas` se borró en la misma migración: ninguna consulta lo usa ya. La regla vive en un solo lugar, `src/repositories/ultimaSenalVenta.js`. La prueba `nearbyIndexPlan.test.js` se amplía para sembrar volumen en `senales_venta` y exigir el índice.

**Cambio de comportamiento a propósito:** hoy un "no" a una pregunta no apaga un "sí" anterior (hipótesis sin verificar, sección 2). Con esta regla sí lo apaga. Ver decisión DP-3.

### 5.3 Rutas (se agregan a `openapi.yaml` junto con la implementación)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `PUT /businesses/{businessId}/selling-now` | Solo el dueño (`authenticate` + autorización a nivel de objeto) | `200` `{ availabilityConfirmedAt, expiresAt, saved }` |
| `DELETE /businesses/{businessId}/selling-now` | Solo el dueño | `204` |

`PUT` (y no `POST`) porque la operación es idempotente en su efecto: "dejar al negocio en estado vendiendo". `DELETE` registra una señal `dejo_de_vender` (no borra filas: el historial sirve para métricas y abuso). Un `DELETE` sin aviso vigente es un no-op silencioso (`204`), mismo criterio que favoritos (Épica 7).

### 5.4 Reglas de validación

| Caso | Respuesta |
|---|---|
| Sin token o token inválido | `401` |
| No es el dueño | `403` |
| Negocio inexistente o id mal formado | `404` |
| Negocio no `activo` (pendiente, rechazado, suspendido, cerrado) | `409` — no tiene sentido anunciar un negocio que no es visible |
| Fuera de su horario declarado y de sus franjas (ver DP-1) | `409` con `type` `.../errors/selling-now-off-schedule` |
| Confirmación a menos de `SELLING_NOW_MIN_INTERVAL_MINUTES` (5) de la confirmación vigente, venga de un aviso propio o de un "sí" **[v0.2]** | `200` con `saved: false` y el `availabilityConfirmedAt` vigente (no se inserta fila, no es error: evita el doble toque) |

Las inserciones de un mismo negocio se serializan con `pg_advisory_xact_lock` por negocio (mismo patrón que fotos y ubicación en vivo), para que dos toques simultáneos no creen dos filas.

### 5.5 Límites y protección contra abuso

| Riesgo | Protección |
|---|---|
| Dejar el aviso "siempre encendido" con toques automáticos | Vence a los 60 min; renovar exige una acción; intervalo mínimo de 5 min entre filas; tope diario `SELLING_NOW_DAILY_MAX` = 30 señales por negocio (cubre una jornada de 12 h renovando cada ~25 min). Pasado el tope: `429` |
| Anunciarse fuera de horario para aparecer en "Disponibles ahora" | La confirmación propia **no** cambia el filtro `openNow` ni la visibilidad: un negocio aparece o no según las reglas de siempre (activo, teléfono verificado, horario). Solo agrega la insignia y el orden de desempate que ya existe |
| Confirmar un negocio ajeno | `403` por autorización a nivel de objeto; prueba explícita con otro vendedor |
| Confirmar un negocio suspendido para seguir apareciendo | `409` para cualquier estado distinto de `activo` |
| Aviso falso ("vendiendo" sin estar) | Los consumidores ya pueden reportar información desactualizada (RF-025, `POST /businesses/{id}/outdated-reports`). Ver DP-5 |
| Volumen de filas | Una fila cada ≥ 5 min por negocio como máximo, tope de 30 por día: acotado. Sin limpieza por ahora (ver DP-6) |

Constantes nuevas en `src/config/constants.js` (valores propios, no citados de ningún documento): `SELLING_NOW_MIN_INTERVAL_MINUTES = 5`, `SELLING_NOW_DAILY_MAX = 30`. La frescura reusa `AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES = 60`.

### 5.6 Contrato de lectura

- `Business.availabilityConfirmedAt` no cambia de forma ni de nombre.
- ~~Nuevo `sellingNow` solo para el dueño en `GET /businesses/{businessId}`~~ **[v0.2] Descartado:** la página del perfil se genera en el servidor sin la sesión del vendedor (el token vive solo en el navegador, CLAUDE.md §21), así que un campo "solo para el dueño" nunca llegaría. La tarjeta calcula el vencimiento en el navegador como `availabilityConfirmedAt + 60 min` (dato público) y usa `expiresAt` de la respuesta de `PUT` tras cada acción.
- Sin campo que diga si la confirmación fue propia o por pregunta (DI-07: cuentan igual).

## 6. Cambios de interfaz (sin ancla)

### 6.1 Perfil del negocio, vista del dueño (su pantalla de inicio, CLAUDE.md §38)

Una tarjeta **arriba de todo**, antes de los interruptores y del catálogo, porque es la acción más frecuente del vendedor:

| Estado | Contenido |
|---|---|
| Sin aviso vigente | Ícono `SealCheck`, texto "¿Estás vendiendo ahora? Avísales a tus clientes." y botón principal **"Estoy vendiendo ahora"** |
| Aviso vigente | "Vendiendo ahora · confirmado hace X · se vence en Y min", botón principal **"Sigo vendiendo"** (renueva) y botón secundario **"Ya no estoy vendiendo"** |
| Faltan 10 minutos o menos | Igual, con "se vence en Y min" resaltado (sin color de error: no es un fallo) |
| Negocio no activo | La tarjeta no aparece (el banner de estado ya explica por qué) |
| Fuera de horario (409) | Mensaje: "Según tu horario ahora estás cerrado. Si estás vendiendo, actualiza tu horario o tus puntos por hora." (ver DP-1) |

- "Ya no estoy vendiendo" es reversible (se puede volver a confirmar), así que no pide confirmación; cuando exista el aviso con "Deshacer" (R4) se usa ahí.
- **[v0.2]** El tiempo restante se calcula en el navegador (`availabilityConfirmedAt + 60 min`) y se refresca cada 30 s. Texto con `suppressHydrationWarning`, igual que los otros "hace X".
- Responder "sí" en `VendorAvailabilityRequestsPanel` actualiza esta misma tarjeta (mismo estado local), porque cuenta igual.
- Mensajes de error nuevos en `error-messages.ts` (401, 403, 404, 409 no activo, 409 fuera de horario, 429).

### 6.2 Lo que ve el consumidor

Nada nuevo que construir: `AvailabilityConfirmedBadge`, `DiscoveryRow` ("Vendiendo ahora") y el orden de "Disponibles ahora" ya leen `availabilityConfirmedAt`. La frescura en los pines es R12, aparte.

### 6.3 Con el ancla (fuera de este alcance, referencia)

En `docs/integracion-ancla.md` §4.4, "Estoy vendiendo ahora" ocupa P1 del abanico del vendedor y usa las mismas dos rutas. No se construye en R5.

## 7. Pruebas

### Unitarias
- Regla "última señal": combinaciones de señales propias y respuestas (vendiendo → dejo; sí → no; no → vendiendo; vencida a los 60 min exactos y a 59:59).
- Validador del cuerpo (vacío) y constantes.

### Integración (Postgres/PostGIS real)
- `PUT` feliz: `200`, y `availabilityConfirmedAt` aparece en `/businesses`, `/nearby`, `/businesses/{id}` y `/users/me/favorites`.
- Renovar: segunda confirmación después de 5 min mueve la fecha; antes de 5 min devuelve `saved: false` sin fila nueva.
- Vencimiento: con la fila movida 61 min al pasado por SQL, `availabilityConfirmedAt` es `null`.
- `DELETE`: apaga una confirmación vigente; sin aviso vigente es `204` igual.
- Última señal: "sí" por pregunta y luego `DELETE` → `null`; `DELETE` y luego "sí" → vigente; **regresión de la hipótesis de la sección 2**: "sí" y luego "no" → `null`.
- Autorización: `401` sin token, `403` otro vendedor, `403`/`401` consumidor, `404` negocio inexistente.
- `409` para cada estado no activo; `409` fuera de horario y fuera de franja; `200` dentro de una franja del ambulante.
- `429` al pasar el tope diario.
- Dos `PUT` concurrentes → una sola fila.
- La confirmación propia no hace aparecer un negocio que el filtro `openNow` o la verificación de teléfono dejaban afuera.
- Plan de ejecución: `nearbyIndexPlan.test.js` con volumen en `senales_venta`, sin seq scans.

### Interfaz
- Playwright contra el servidor real: el dueño confirma, ve "se vence en 60 min", renueva, termina; un consumidor en otra sesión ve y deja de ver la insignia sin cambiar nada más; un consumidor no ve la tarjeta.
- Prueba manual en PC y en celular (Nubia) y en vista de iPhone SE, como pide el plan del ancla.

### Carga
- Repetir `scripts/loadtest-nearby.js` (k6, 50 VUs) con señales sembradas; debe seguir dentro de p95 < 300 ms. Antes, actualizar el centro viejo de `seedLoadTest.js`/`loadtest-nearby.js` (gap conocido de CLAUDE.md §58).

## 8. Fuera de alcance

- Notificación push a los favoritos cuando un vendedor confirma (depende de Firebase, Fase 6 pendiente).
- Recordatorio al vendedor antes de que venza (también push).
- Encender "Estoy vendiendo" automáticamente al compartir la ubicación en vivo (ver DP-4).
- Integración con el ancla (etapa I4).

## 9. Decisiones (aplicadas en v0.2)

Todas se aplicaron como se propusieron. Detalle de implementación en la última columna.

| ID | Pregunta | Propuesta | Implementación |
|---|---|---|---|
| DP-1 | ¿Se puede confirmar fuera del horario declarado? | **No** (409), igual que la ubicación en vivo. Evita que el aviso sirva para aparecer fuera de horario y empuja al vendedor a mantener su horario al día. Alternativa: permitirlo y mostrar un aviso "fuera de tu horario"; es más flexible para vendedores informales, pero el dato de horario queda desalineado | 409 con `type` `.../errors/selling-now-off-schedule`; reusa `posicionesEnVivo.repository.js#estaEnHorarioOFranja` (horario o franja vigente) |
| DP-2 | ¿Tabla nueva o reusar `solicitudes_disponibilidad`? | **Tabla nueva** (`senales_venta`), por lo explicado en 5.1. Costo: la consulta de frescura lee dos fuentes | Tabla `senales_venta` (migración `senales-venta`) |
| DP-3 | ¿Un "no" a una pregunta apaga un "sí" anterior? | **Sí** (regla de última señal). Primero confirmar con una prueba que hoy no lo apaga; si ya lo apagara, no hay cambio de comportamiento | Confirmado con prueba y corregido |
| DP-4 | ¿Compartir la ubicación en vivo cuenta como "estoy vendiendo"? | **No automáticamente.** Al encender la ubicación en vivo, sugerir (un toque) confirmar también. Son dos consentimientos y dos datos distintos | `SellingNowSuggestion` bajo el interruptor de ubicación en vivo, solo si no hay aviso vigente |
| DP-5 | ¿Un motivo propio "dice que vende pero no está" en los reportes? | **Sí, más adelante**, sin tocar R5: RF-025 acepta un motivo libre; basta con ofrecer ese texto como opción rápida en el frontend. Si se acumulan reportes, la cola de moderación (panel, Fase 2+) decide | Sin cambios en R5 |
| DP-6 | ¿Limpiar filas viejas de `senales_venta`? | **No por ahora.** Con los topes, el volumen está acotado. Si hace falta, limpieza perezosa como en ubicación en vivo | Sin limpieza |
| DP-7 | ¿Evento de analítica nuevo? | **Sí**, agregar `confirmacion_venta` a `tipo_evento` para medir el KPI de frescura. Requiere migración del ENUM; se puede dejar para después sin romper nada | `confirmacion_venta` agregado a `tipo_evento`; lo inserta el servidor en la misma transacción que el aviso. `POST /events` no lo acepta (el validador no cambió) |
| DP-8 | ¿Intervalo mínimo y tope diario? | **5 min y 30 por día**, cifras propias. Revisar con datos del piloto | `SELLING_NOW_MIN_INTERVAL_MINUTES = 5`, `SELLING_NOW_DAILY_MAX = 30` en una **ventana móvil de 24 h** (no día calendario). Solo cuentan los avisos "vendiendo": apagar siempre funciona |
| DP-9 | ¿El consumidor ve si fue propia o por pregunta? | **No** (DI-07: cuentan igual). Un solo texto: "Vendiendo ahora · confirmado hace X" | Sin campo de origen en la API |
| DP-10 | Texto del botón | **"Estoy vendiendo ahora"** / **"Sigo vendiendo"** / **"Ya no estoy vendiendo"**. Validar con vendedores reales en la etapa I6 | Textos aplicados en `selling-now-card.tsx` |
