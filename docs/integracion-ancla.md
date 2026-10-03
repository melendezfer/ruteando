# Integración del botón-ancla en RUTEANDO

Versión 0.3 · 2026-09-27 · Estado: **verificado contra el código; decisiones DI-01 a DI-07 tomadas**

> **Cambios v0.3:** decisiones DI-01 a DI-07 tomadas por el usuario (sección 9) y cinco prerrequisitos nuevos, R10 a R14 (sección 2), salidos de la verificación de la v0.2.

Fuentes: `docs/inventario-ancla.md`, `docs/backlog-integracion-ancla.md` (RUTEANDO) y la spec del botón-ancla (Fases 1 y 3, hallazgos HM-01 a HM-18).

> **[Corregido v0.2]** `docs/inventario-ancla.md` y `docs/backlog-integracion-ancla.md` no están en `develop`: viven solo en la rama `feature/inventario-ancla` (sin fusionar). Esta rama sale de `develop`, así que esos dos enlaces no resuelven aquí hasta que esa rama se fusione.

> Este documento es una propuesta. En la v0.2 cada afirmación sobre el código de RUTEANDO se revisó contra `develop` (commit `67a6d23`, 2026-09-27), solo leyendo el código, sin correr la app. Marcas usadas:
> - **[Verificado]**: coincide con el código.
> - **[Corregido]**: no coincidía; el texto ya está corregido.
> - **Hipótesis sin verificar**: no se pudo comprobar leyendo el código (hace falta la app corriendo o una prueba).
>
> Lo que el documento dice sobre la demo y la spec del botón-ancla (HM-xx, D-xx, C-xx) está fuera de esta revisión: no se contrastó con el repo `boton-ancla`.

---

## 0. Principios

1. **El ancla es un atajo, nunca la única puerta.** Todo lo que se hace con el ancla debe poder hacerse también con la interfaz normal (tocar un pin, una fila o un botón). Primero se construye la función en RUTEANDO con botones normales; después se le agrega el atajo del ancla.
2. **Tres modos en Ajustes:** **Completo** (menú, joystick, apuntar y elegir), **Solo menú** (sin joystick) y **Apagado**. Con el ancla apagada, RUTEANDO muestra los botones flotantes de hoy (navegación de 4 círculos, WhatsApp, Cómo llegar). Con el ancla encendida, el ancla los reemplaza (decisión D-06).
3. **Todo solo deslizando (D-15)** cuando el ancla está encendida; el toque es alternativa, nunca requisito.
4. **Reglas del ancla que se respetan en todas las pantallas:** la posición de 90° es de la familia "volver" (Atrás / Cerrar) o una acción inofensiva (HM-14); soltar ejecuta (lección de HM-17); las opciones no cambian de lugar; un ícono, un solo significado (`lib/icons/semantic-icons.ts`).
5. **Frescura visible:** todo dato que depende del vendedor muestra cuándo se confirmó.
6. **Nada se integra sin prueba manual en PC y celular**, además de las pruebas automáticas.

---

## 1. Estrategia técnica

| Tema | Propuesta | Decisión pendiente |
|---|---|---|
| Cómo llega el código a RUTEANDO | Consumir los paquetes `core` y `react` del repo `boton-ancla` por versión (etiqueta de Git). Opciones: (a) dependencia de Git con etiqueta; (b) paquete en GitHub Packages; (c) copia versionada con un script. | **DI-01: decidido (c)** — copia versionada por script desde una etiqueta (la primera es `v0.3.0`) + `transpilePackages` de Next |
| Interruptor | Una bandera `NEXT_PUBLIC_ANCLA` más el modo elegido por el usuario en Ajustes. En producción empieza apagado. | — |
| Estilos | El ancla usa los tokens de RUTEANDO (`terracota`, `surface`, `border`, `text`, `text-muted`); sin colores escritos a mano (D-19). **[Verificado]** los cinco existen como `--color-*` en `client/src/app/globals.css` (ojo: `terracota` hoy es violeta, `#5b3df5`). | — |
| Íconos | Phosphor desde `@phosphor-icons/react/dist/ssr`, registrados en `semantic-icons.ts`. **[Verificado]** es la ruta que usan los componentes (45 importaciones); `@phosphor-icons/react` a secas solo se importa para el tipo `Icon`. | — |
| Capa (z-index) | **[Corregido]** El borrador suponía que los modales van por encima de las hojas. No es así: la mayoría de los modales usa `z-50`, **por debajo** de las hojas del mapa (`z-[1000]`). Un ancla en `> z-[1000]` quedaría **encima** de casi todos los modales, no debajo. Ver el orden real en DI-02 (sección 9). | **DI-02: decidido** — escala nombrada (flotantes 40, hojas 1000, ancla 1050, modales 1100) y todos los modales a 1100 antes de I1 (R14) |
| Rutas sin ancla | `/login`, `/register`, recuperar/restablecer, `/legal/*`, `/admin/*`. **[Verificado]** existen: `(auth)/login`, `(auth)/register`, `(auth)/recuperar-contrasena`, `(auth)/restablecer-contrasena`, `legal/terminos-condiciones`, `legal/tratamiento-datos`, `admin/`, `admin/login`, `admin/dashboard`. `/favoritos` es solo un `redirect` a `/mapa?favoritesOnly=true`. | — |

---

## 2. Prerrequisitos en RUTEANDO (antes del ancla)

Sale del backlog y del inventario. **Bloquea** indica qué frena cada punto.

| # | Qué | Bloquea | Estado |
|---|---|---|---|
| R1 | Fusionar PR 3 de íconos (`feature/iconos-pantallas`) | Integración | **[Corregido] Hecho**: fusionado en `develop` (PR #89, commit `67a6d23`) |
| R2 | Fusionar `fix/credito-osm-visible` (crédito arriba a la derecha) | Integración y licencia | **[Verificado]** la rama existe (local y en `origin`, commit `11ec7f3`) y **no** está fusionada en `develop`. Que falte probarla en celular es hipótesis sin verificar |
| R3 | Interruptor rápido "Disponible / Agotado" en la fila del producto | Acción del vendedor en el ancla | **[Verificado] Pendiente**: `product-row.tsx` solo muestra el estado ("Disponible/No disponible hace X"); cambiarlo exige abrir el formulario de edición (`ProductForm`) |
| R4 | Componente único de aviso con "Deshacer" + hoja de confirmación (`ConfirmSheet`) que reemplace los `window.confirm` | Acciones reversibles e irreversibles del ancla | **[Verificado] Pendiente**: no hay ningún aviso con "Deshacer" ni `ConfirmSheet`. Hay exactamente dos `window.confirm`: borrar un producto (`product-row.tsx`) y salir del asistente (`business-registration-wizard.tsx`) |
| R5 | **Botón "Estoy vendiendo ahora" (confirmación proactiva)**. Hoy el vendedor solo responde preguntas; no puede avisar por su cuenta que abrió. Es la función más valiosa según el análisis competitivo. | Frescura del dato y acción principal del vendedor | **[Verificado] No existe.** Ver el detalle abajo. **Actualización:** implementado en `feature/r5-estoy-vendiendo`, pendiente de prueba manual (`docs/specs/r5-estoy-vendiendo.md`) |
| R6 | Panel de administrador, fase 1 (negocios pendientes con la API nueva y auditoría) | **El piloto** (no la integración) | **[Corregido] Pendiente, con matiz**: la "Fase 1" del panel nuevo (CLAUDE.md §57) ya está en `develop`, pero solo es la base (login, `/admin/dashboard`, auditoría sin uso) con `ADMIN_MODULES = []`. Lo que falta es la **Fase 2**: la cola de negocios pendientes. La API vieja `GET /admin/businesses/pending` (Épica 9) sí existe, sin pantalla en el panel nuevo |
| R7 | Editar negocio y horario después del registro | Perfil del vendedor completo | **[Verificado] Pendiente, con matiz**: el horario solo se edita en el asistente (`PUT .../schedule` no tiene otra pantalla) y tampoco hay UI para nombre, descripción, categoría ni teléfono (el backend `PATCH /businesses/{id}` sí lo permite). Lo que **sí** se edita ya desde el perfil: interruptores (domicilios, bancas, higiene, modalidad), ubicación en el mapa, franjas del ambulante, fotos y catálogo |
| R8 | Botón "Limpiar búsqueda" en `/buscar` | Acción del ancla en Buscar | **[Verificado] Pendiente**: "Limpiar búsqueda" solo existe dentro de la hoja de búsqueda del mapa (`map-search-sheet.tsx`), no en `home-screen.tsx` |
| R9 | Hoja de búsqueda a 320 px | Pantallas pequeñas | Hipótesis sin verificar (necesita la app corriendo a 320 px) |
| R10 | **Nuevo (v0.3).** WhatsApp y acceso a la Carta en la hoja resumen del negocio (mapa), con la interfaz normal | Capa "Resumen del negocio" del ancla (4.1) | Pendiente — hoy la hoja no los tiene (verificado en v0.2) |
| R11 | **Nuevo (v0.3).** Lista del grupo de pines: al tocar un grupo, ver sus negocios en una lista (versión sin ancla primero, principio 1) | Capa "Grupo de pines" del ancla (4.1) | Pendiente — hoy tocar un grupo solo acerca el mapa |
| R12 | **Nuevo (v0.3).** Frescura en los pines ("confirmado hace X" o marca equivalente) | Principio 5 (frescura visible) en el mapa | Pendiente — las tarjetas ya la muestran, los pines no |
| R13 | **Nuevo (v0.3).** Zoom de un dedo en el mapa (HM-18 del repo `boton-ancla`), **siempre**, con o sin ancla | DI-03 | Pendiente |
| R14 | **Nuevo (v0.3).** Escala de capas nombrada (flotantes 40, hojas 1000, ancla 1050, modales 1100) y todos los modales a 1100. Incluye verificar con la app corriendo la hipótesis del mapa chico del dueño sin `isolate` | **I1** (debe estar antes) | Pendiente |

**R5, detalle de la verificación.** `availabilityConfirmedAt` ("confirmado hace X") sale **solo** de filas de `solicitudes_disponibilidad` con `decision = 'confirmada'` (`negocios.repository.js` y `favoritos.repository.js`), y la única escritura de `decision` es `PATCH /availability-requests/{id}/respond`, que necesita una pregunta previa de un consumidor. No hay ninguna ruta, botón ni texto "Estoy vendiendo ahora" en el backend ni en el cliente. Lo más parecido que existe es la **ubicación en vivo** (`POST /businesses/{id}/live-location`), que es proactiva pero solo para ambulantes y no marca `availabilityConfirmedAt`. Construir R5 exige backend (una confirmación sin pregunta previa, con la misma frescura de 60 min), no solo un botón.

---

## 3. Lo que se trae de la demo además del ancla

En la prueba manual, la demo se percibe más pulida que RUTEANDO. Se traen estas piezas, que sirven con o sin ancla:

- Hojas inferiores que reservan la franja del lado del ancla (HM-07) y suben sobre el teclado (HM-05).
- Banda de etiqueta única y legible (HM-02).
- Aviso con "Deshacer" (C-03, C-21).
- Frescura del dato en pines y tarjetas ("confirmado hace X"). **[Corregido]** en tarjetas ya existe: `BusinessCard` muestra `AvailabilityConfirmedBadge` y `DiscoveryRow` dice "Vendiendo ahora" cuando hay confirmación. Lo que falta es solo en los **pines** (`leaflet-map.tsx` no usa `availabilityConfirmedAt`).
- Hoja del negocio con acciones claras y "Ver perfil completo".
- Zoom de un dedo en el mapa (HM-18), útil aunque el ancla esté apagada. **Decidido (v0.3): siempre, con o sin ancla (R13).**
- Métricas locales opcionales para las pruebas con personas.

---

## 4. Acciones por pantalla y rol

Convención: **90°** es la posición de arriba (volver o inofensiva). P1 a P4 van de la posición más cómoda (diagonal) a la menos cómoda. "Ocultar teclado" lo agrega el sistema a 180° cuando hay teclado (HM-06). "Deshacer" ocupa P1 mientras está visible (C-21). Máximo 5 opciones en total.

### 4.1 Mapa (`/`, `/mapa`) — todos los roles con sesión

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Mapa | Mi ubicación | Buscar | Favoritos | Mi perfil / Mi negocio | Zoom |

- **Joystick:** mueve el mapa (HM-11); apuntar y elegir pines y grupos (HM-12a).
- **Decisión DI-03:** hoy la navegación flotante tiene "Perfil". Con Zoom (pedido por 2 de 2 personas) no cabe "Disponibles ahora" ni "Ofertas cerca"; quedan en el carrusel superior y en "Ver todas". Alternativa: cambiar Favoritos por "Disponibles ahora". **Decidido (v0.3):** Mi ubicación · Buscar · Favoritos · Mi perfil · Zoom. Con el ancla encendida se ocultan los `+/−` de Leaflet; con el ancla apagada se muestran. El zoom de un dedo (R13) está siempre.

**Capas del mapa**

| Capa | Centro | Acciones |
|---|---|---|
| Hoja de búsqueda | Lupa, "Buscar" | Limpiar búsqueda · Solo abiertos (interruptor) · Sencilla/Avanzada |
| Resumen del negocio (pin elegido) | Ícono de su categoría + nombre | Carta/Productos/Servicios · Cómo llegar · WhatsApp (si tiene) · Favorito · botón "Ver perfil completo" |
| Lista filtrada | Ícono de la pestaña | Cambiar pestaña · Ver en el mapa · apuntar y elegir filas |
| Grupo de pines | "N negocios" | Lista del grupo con apuntar y elegir |

**Verificación de las capas del mapa:**
- **[Verificado]** Hoy la navegación flotante (`main-floating-nav.tsx`) tiene, en orden: Mi ubicación (o "Volver al mapa" si no hay mapa visible), Buscar, Perfil, Favoritos. Zoom existe como el control `+/−` por defecto de Leaflet (arriba a la izquierda), no como botón flotante.
- **[Verificado]** Hoja de búsqueda: "Limpiar búsqueda", "Abierto ahora" (en los dos modos) y "Sencilla/Avanzada" existen.
- **[Corregido]** Resumen del negocio: hoy (`business-summary-sheet.tsx` → `BusinessCard`) tiene favorito, horario de hoy, calificación, "Ver perfil completo" y "Cómo llegar". **No** tiene WhatsApp ni acceso a la Carta. Por el principio 1, esas dos acciones hay que agregarlas primero a la interfaz normal.
- **[Corregido]** Grupo de pines: hoy tocar un grupo solo acerca el mapa (comportamiento por defecto de `react-leaflet-cluster`, sin opciones propias). No existe una "lista del grupo": sería una función nueva y, por el principio 1, también necesita su versión sin ancla.
- **[Verificado]** Lista filtrada: pestañas (Disponibles ahora, Cerca de ti ahora, Favoritos, categoría u oferta) y tocar una fila abre el perfil completo.

### 4.2 Buscar (`/buscar`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Lupa, "Buscar" | Volver al mapa | Limpiar búsqueda (R8) | Solo abiertos | Sencilla/Avanzada | Favoritos |

Joystick: desplaza la lista; apuntar y elegir tarjetas.

### 4.3 Perfil de negocio — visitante o consumidor (`/negocios/[id]`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Ícono de su categoría + nombre | Volver | WhatsApp | Cómo llegar | Favorito | Preguntar si está vendiendo |

- "Preguntar si está vendiendo" hoy no se puede cancelar: en el ancla es **irreversible** (deslizar más allá). **DI-04:** agregar "cancelar pregunta" en el backend para volverla reversible. **[Verificado]** `availabilityRequests.routes.js` solo tiene `GET /{id}` y `PATCH /{id}/respond`; no hay forma de cancelar.
- **[Corregido]** Un **visitante sin sesión** no ve "Favorito" ni "Preguntar si está vendiendo": los dos requieren sesión (el botón de preguntar además exige no ser el dueño). Para el visitante anónimo el abanico se reduce a Volver, WhatsApp y Cómo llegar.
- Joystick: desplaza la página; apuntar y elegir filas de la carta (se expanden).
- Zonas: "Volver" (arriba izq.) y corazón (arriba der.) son preferidas; los botones flotantes de hoy desaparecen con el ancla encendida. **[Verificado]** `BackButton` fijo arriba a la izquierda, corazón (o engranaje, si es el dueño) arriba a la derecha; los flotantes de hoy son WhatsApp, Cómo llegar y Volver al mapa.

### 4.4 Perfil de negocio — dueño (inicio del vendedor)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| "Mi negocio" | Ir al mapa (inofensiva) | **Estoy vendiendo ahora** (R5) | ¿Qué se acabó? (R3) | Ubicación en vivo (solo ambulante) | Publicar oferta |

- **Preguntas pendientes:** cuando hay preguntas de disponibilidad sin responder, "Responder (N)" toma P1 temporalmente, igual que Deshacer. **[Verificado]** la base existe: `VendorAvailabilityRequestsPanel` consulta las pendientes cada 8 s y ofrece Confirmar/Declinar.
- **¿Qué se acabó?** abre una capa con la lista de productos e interruptores Disponible/Agotado, con apuntar y elegir. Cada cambio ofrece Deshacer.
- **Publicar oferta** abre el formulario de producto que ya existe, con la casilla "Es una oferta con vigencia" encendida (sugerencia del backlog). **[Verificado]** la casilla existe en `product-form.tsx` con ese texto exacto.
- **Ubicación en vivo:** encender y apagar son reversibles; el consentimiento de la primera vez sigue siendo el modal actual. **[Verificado]** `LiveLocationToggle` + `LiveLocationConsentModal`, solo para ambulantes.
- Para vendedores de puesto fijo o local, P3 pasa a "Editar horario" (R7).

### 4.5 Cuenta y perfil del consumidor (`/perfil`, `/cuenta`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| "Mi cuenta" | Volver al mapa | Mis reseñas | Configuración | Favoritos | — |

Regla: **las acciones críticas de la cuenta no van en el ancla** (cambiar contraseña, eliminar cuenta, retirar consentimientos). Se hacen solo con la interfaz normal y su confirmación.

**[Verificado]** `/perfil` y `/cuenta` tienen dos pestañas: Reseñas y Configuración (Favoritos dejó de ser pestaña). **[Corregido]** "Retirar consentimientos" no existe hoy: `consents.routes.js` no tiene `DELETE` ni `PATCH` (los consentimientos son de solo agregar). "Eliminar cuenta" tampoco borra: crea una **solicitud** de eliminación (CLAUDE.md §23).

### 4.6 Asistente de registro (`/negocios/nuevo`)

| Centro | 90° | P1 | P2 |
|---|---|---|---|
| "Nuevo negocio · paso N de 3" | Paso anterior | Siguiente paso | Salir (irreversible → `ConfirmSheet`) |

Con teclado: "Ocultar teclado" a 180°.

**[Verificado]** 3 pasos numerados ("Paso N de 3": datos, ubicación, horario); "Atrás" existe en los pasos 2 y 3. Salir usa `window.confirm` (ver R4). **[Corregido]** hay pantallas del asistente sin número ("elección de modalidad", resultado final, y las ramas de administrador y consumidor): ahí el centro no puede decir "paso N de 3".

### 4.7 Selector de negocio (vendedor con 2 o más)

| Centro | 90° | Acciones |
|---|---|---|
| "Mis negocios" | Ir al mapa | Apuntar y elegir un negocio de la lista |

### 4.8 Sin ancla

Entrada (`/login`, `/register`, recuperar), textos legales y panel de administrador. **DI-05:** revisar después si el panel de administrador en celular se beneficiaría del ancla (colas de aprobación).

---

## 5. Zonas reservadas por pantalla

| Pantalla | Obligatorias (nunca se tapan) | Preferidas (se evitan) |
|---|---|---|
| Mapa | Crédito de OpenStreetMap | Logo "Ruteando", botones +/− de zoom (solo con el ancla apagada; con el ancla encendida se ocultan, DI-03), tarjeta de comparación de zonas |
| Perfil de negocio | Crédito OSM del mapa chico (dueño) | "Volver", corazón o engranaje |
| Todas | Áreas seguras del sistema | — |

Con el ancla apagada, la navegación flotante vuelve a su lugar; su choque con el crédito OSM ya queda resuelto por R2.

### 5.1 Columna de navegación: el lugar del ancla (DI-08, 2026-10-03)

Decidido por el usuario y construido en la Etapa 1b del Perfil 2.0 (`docs/specs/perfil-2.md` §8.1, CLAUDE.md §63):

- **Arriba** solo "Volver" y el título de la pantalla, donde haga falta. Sin íconos de acción.
- **Costado derecho, zona media-baja** (alcance del pulgar): una sola columna de botones de 44 px — Buscar, Favoritos, Perfil y, con el mapa visible, Ubicarme. Sin letreros a la vista; el nombre aparece solo al mantener presionado (táctil) o al pasar el mouse (PC). Posición: a 12 px del borde derecho, borde inferior a `18vh` + área segura (`--columna-abajo`, `globals.css`).
- **Franja reservada**: el contenido, las hojas inferiores y los avisos de las pantallas con columna dejan libre esa franja (`.reserva-columna`, 64 px), igual que HM-07 hace con el lado del ancla. El crédito de OpenStreetMap sigue siendo zona obligatoria (arriba a la derecha, no choca con la columna).
- **Con una hoja o el teclado abiertos**, la columna queda en un solo botón ("Volver al mapa": en el mapa cierra la hoja).
- **Al integrar el ancla, el ancla reemplaza la columna en el mismo lugar.** Como el contenido ya reserva esa franja, encender el ancla no mueve nada más de la pantalla. Esto reemplaza la posición "abajo a la derecha" de la navegación flotante citada arriba.
- **Hipótesis sin verificar:** que `18vh` coincida con el alto de reposo del ancla; ajustar `--columna-abajo` al integrar si la demo usa otro.

**[Verificado]** posiciones actuales: logo "Ruteando" abajo a la izquierda (`fixed bottom-6 left-6`), tarjeta de comparación de zonas **arriba** (`top-3`), `+/−` de Leaflet arriba a la izquierda, navegación flotante abajo a la derecha. El mapa chico del dueño (`location-pin-editor.tsx`) sí lleva su propio crédito OSM. Que R2 resuelva el choque es hipótesis sin verificar hasta probar la rama en celular.

---

## 6. Íconos a registrar o revisar

| Significado | Ícono propuesto | Nota |
|---|---|---|
| Cerrar capa | `X` | **[Corregido]** no es nuevo: `X` ya se usa para cerrar en 8 componentes (hojas, modales, asistente). Solo falta registrarlo en `SEMANTIC_ICONS` |
| Deshacer | `ArrowCounterClockwise` | Nuevo **[Verificado]** (no se usa en ningún lado) |
| Agotado / no disponible | `MinusCircle` | Nuevo **[Verificado]**; `Prohibit` ya significa "negocio suspendido" (`business-status-banner.tsx`) |
| Estoy vendiendo ahora | Por decidir | **DI-06**. **[Corregido]** `DoorOpen` = "abierto según el horario" y `SealCheck` = "el vendedor CONFIRMÓ que está vendiendo" (`SEMANTIC_ICONS.confirmedSelling`). `SealCheck` no tiene "otro significado": es el mismo hecho que produce R5 (ver opinión en DI-06) |
| Marcar favorito / lista de Favoritos | `Heart` / `ListHeart` | **[Verificado]** hoy `Heart` es las dos cosas: el botón de marcar (`favorite-button.tsx`) y abrir la lista (`main-floating-nav.tsx`, pestaña de `filtered-list-sheet.tsx`). `ListHeart` no se usa todavía |
| Secciones de perfil | `IdentificationCard` | No usar `Storefront` (**[Verificado]** significa modalidad "local"). `IdentificationCard` no se usa todavía |
| Zoom | Por decidir | El que usa la demo |

---

## 7. Plan por etapas

Cada etapa termina con pruebas automáticas y **prueba manual en PC y celular** antes de la siguiente.

| Etapa | Contenido | Criterio de salida |
|---|---|---|
| I0 | Prerrequisitos R1 a R5 y R8 (R6 y R7 en paralelo, porque bloquean el piloto, no la integración). **[Corregido]** R1 ya está hecho. **v0.3:** también R10 a R14; R14 es obligatorio antes de I1 | Cada uno fusionado con sus pruebas |
| I1 | Infraestructura: dependencia (DI-01), bandera, proveedor, tokens, modos en Ajustes, respaldo con la navegación de hoy | Con el ancla apagada, RUTEANDO se ve y funciona igual que antes |
| I2 | Mapa del consumidor, con capas, joystick y apuntar y elegir | Recorrido "buscar y llegar a un negocio" solo deslizando |
| I3 | Perfil del negocio (visitante) | Contactar y llegar a un negocio sin salir del ancla |
| I4 | Inicio del vendedor: estoy vendiendo, agotado, preguntas, ubicación en vivo, oferta | Un vendedor actualiza su estado con una mano |
| I5 | Buscar, Cuenta, asistente y selector | Todas las pantallas con sesión tienen su abanico |
| I6 | Pruebas con personas (vendedores y consumidores) y ajustes | Hallazgos registrados y resueltos |

---

## 8. Pruebas

- **Por pantalla:** E2E con el ancla en los tres modos (Completo, Solo menú, Apagado).
- **Recorrido solo deslizando:** consumidor (buscar → elegir → cómo llegar) y vendedor (estoy vendiendo → marcar agotado → deshacer).
- **Zonas:** la prueba del crédito OSM se amplía para que falle si el ancla o su abanico lo tapan.
- **Regla de 90°** y **un ícono, un significado:** validaciones automáticas, como en la demo.
- **Manual:** PC y Nubia en cada etapa, y al menos un celular pequeño (o la vista de iPhone SE del navegador).

---

## 9. Decisiones (tomadas en v0.3)

| ID | Pregunta | Propuesta | Opinión (Claude, v0.2) | Decisión (usuario, v0.3) |
|---|---|---|---|---|
| DI-01 | ¿Cómo llega el código del ancla a RUTEANDO? | Dependencia de Git con etiqueta de versión; si da problemas con el monorepo, GitHub Packages | **En desacuerdo con la opción (a).** npm no instala un subdirectorio de un monorepo desde Git, y `@boton-ancla/core` y `@boton-ancla/react` exportan `.ts` sin compilar (`exports: ./src/index.ts`), con `react` dependiendo de `core` por `"*"` vía workspaces. **[Corregido v0.3]** El repo ya tiene la etiqueta `v0.3.0`. Para empezar, la (c) es la más simple: copiar los dos paquetes por etiqueta con un script y compilarlos con `transpilePackages` de Next. GitHub Packages tiene sentido cuando los paquetes tengan su propio paso de compilación. | **Opción (c):** copia versionada por script (desde la etiqueta `v0.3.0`) + `transpilePackages`. |
| DI-02 | Orden real de capas (z-index) en RUTEANDO | Verificar en el código antes de I1 | **[Verificado]** Orden real, de abajo hacia arriba en el contexto raíz: mapa (`isolate`: Leaflet queda contenido y compite como una sola capa) → tarjeta de zonas `z-30` → flotantes (`FloatingActionStack`, `BackButton`, engranaje, logo) `z-40` → modales `z-50` (consentimiento obligatorio, eliminar cuenta, formulario de producto y su paso de foto, sello de higiene) → hojas del mapa `z-[1000]` (búsqueda, resumen, lista filtrada) → modal de ubicación en vivo `z-[1100]`. **Opinión:** fijar una escala nombrada antes de I1 (por ejemplo flotantes 40, hojas 1000, ancla 1050, modales 1100) y subir todos los modales a 1100, en vez de que el ancla se oculte a mano en cada modal. **Hipótesis sin verificar:** el mapa chico del perfil del dueño (`location-pin-editor.tsx`) no está envuelto en `isolate`; sus paneles de Leaflet podrían pintarse encima de los modales `z-50` de esa misma pantalla (tal vez por eso el modal de ubicación en vivo usa 1100). | **Escala nombrada** (flotantes 40, hojas 1000, ancla 1050, modales 1100) y **todos los modales a 1100 antes de I1** (R14). La hipótesis del mapa chico del dueño se verifica con la app corriendo. |
| DI-03 | ¿Qué opciones van en el mapa? | Mi ubicación · Buscar · Favoritos · Mi perfil · Zoom | **De acuerdo**, con una condición: Zoom ya existe como `+/−` de Leaflet arriba a la izquierda. Si el ancla trae su propio zoom (o el zoom de un dedo, HM-18), conviene ocultar los `+/−` para no tener dos controles de lo mismo. Mantendría Favoritos antes que "Disponibles ahora", que ya tiene el carrusel y "Ver todas". | **De acuerdo.** Ancla encendida: se ocultan los `+/−` de Leaflet; ancla apagada: se muestran. El zoom de un dedo (HM-18) se trae siempre (R13). |
| DI-04 | ¿Se puede cancelar "Preguntar si está vendiendo"? | Agregarlo en el backend para volverla reversible | **De acuerdo, pero sin prisa.** Hoy no hay forma de cancelar (verificado). Mientras no exista el push (Fase 6), el vendedor solo ve la pregunta con su perfil abierto y la pregunta vence sola a los 10 min, así que el costo de no poder cancelar es bajo. Además, cancelar debería seguir contando para el límite de preguntas, para que no se use para esquivarlo. | **De acuerdo** con la opinión. |
| DI-05 | ¿Ancla en el panel de administrador? | No en esta integración; revisar con el panel terminado | **De acuerdo.** El panel nuevo todavía no tiene ningún módulo (`ADMIN_MODULES = []`); no hay nada que agregarle. | **De acuerdo** con la opinión. |
| DI-06 | Ícono de "Estoy vendiendo ahora" | Elegirlo al construir R5 | **Usar `SealCheck`.** Ya está registrado como `confirmedSelling` ("el vendedor confirmó que está vendiendo"), que es justo el hecho que produce R5. Usar otro ícono para lo mismo rompería "un ícono, un significado". | **`SealCheck`.** |
| DI-07 | ¿El vendedor con ancla apagada ve "Estoy vendiendo ahora" como botón fijo? | Sí: la función debe existir sin el ancla (principio 1) | **De acuerdo.** Un matiz: R5 necesita backend (ver el detalle de R5). Hay que decidir si la confirmación propia cuenta igual que responder una pregunta en `availabilityConfirmedAt` (misma frescura de 60 min), para no tener dos "confirmado hace X" distintos. | **De acuerdo.** La confirmación propia cuenta igual que responder una pregunta en `availabilityConfirmedAt` (misma frescura de 60 min). Especificación: `docs/specs/r5-estoy-vendiendo.md` (rama `docs/r5-estoy-vendiendo`). |
| DI-08 | ¿Dónde va la navegación sin ancla, y dónde el ancla? | (Pedido del usuario, 2026-10-03) | — | **Columna derecha, zona media-baja**, botones de 44 px; arriba solo "Volver" + título; el contenido reserva la franja; un solo botón con hoja o teclado; el ancla la reemplaza en el mismo lugar (§5.1). |

---

## 10. Riesgos

- **Exposición del vendedor:** "Estoy vendiendo ahora" y la ubicación en vivo lo hacen visible. El vendedor siempre decide qué y cuándo se ve.
- **Demasiados modos:** con joystick, apuntar, capas y descanso, hay que medir con personas si alguien se pierde. El modo "Solo menú" es la salida simple.
- **Dos repos en paralelo:** un cambio en el ancla puede romper RUTEANDO. Por eso RUTEANDO usa versiones fijas y sube de versión a propósito.
- **Datos que asume este documento:** todo lo que viene del inventario puede tener errores (ya pasó con offerTypeId). Se verifica en el código antes de cada etapa.
