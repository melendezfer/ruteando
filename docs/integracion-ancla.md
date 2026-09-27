# Integración del botón-ancla en RUTEANDO

Versión 0.1 · 2026-09-27 · Estado: **borrador para revisión**

Fuentes: `docs/inventario-ancla.md`, `docs/backlog-integracion-ancla.md` (RUTEANDO) y la spec del botón-ancla (Fases 1 y 3, hallazgos HM-01 a HM-18).

> Este documento es una propuesta. Lo que dice sobre el código de RUTEANDO sale del inventario, no de una revisión nueva del código: cualquier dato que no coincida con el código real se marca como **hipótesis sin verificar** y se corrige antes de programar.

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
| Cómo llega el código a RUTEANDO | Consumir los paquetes `core` y `react` del repo `boton-ancla` por versión (etiqueta de Git). Opciones: (a) dependencia de Git con etiqueta; (b) paquete en GitHub Packages; (c) copia versionada con un script. | **DI-01** |
| Interruptor | Una bandera `NEXT_PUBLIC_ANCLA` más el modo elegido por el usuario en Ajustes. En producción empieza apagado. | — |
| Estilos | El ancla usa los tokens de RUTEANDO (`terracota`, `surface`, `border`, `text`, `text-muted`); sin colores escritos a mano (D-19). | — |
| Íconos | Phosphor desde `@phosphor-icons/react/dist/ssr`, registrados en `semantic-icons.ts`. | — |
| Capa (z-index) | El ancla va por encima de hojas y mapa (`> z-[1000]`), por debajo de los modales (`z-50` / `1100`), que la ocultan. | **DI-02**: confirmar el orden real en el código |
| Rutas sin ancla | `/login`, `/register`, recuperar/restablecer, `/legal/*`, `/admin/*`. | — |

---

## 2. Prerrequisitos en RUTEANDO (antes del ancla)

Sale del backlog y del inventario. **Bloquea** indica qué frena cada punto.

| # | Qué | Bloquea | Estado |
|---|---|---|---|
| R1 | Fusionar PR 3 de íconos (`feature/iconos-pantallas`) | Integración | Pendiente |
| R2 | Fusionar `fix/credito-osm-visible` (crédito arriba a la derecha) | Integración y licencia | Hecho en rama, falta probar en celular y fusionar |
| R3 | Interruptor rápido "Disponible / Agotado" en la fila del producto | Acción del vendedor en el ancla | Pendiente |
| R4 | Componente único de aviso con "Deshacer" + hoja de confirmación (`ConfirmSheet`) que reemplace los `window.confirm` | Acciones reversibles e irreversibles del ancla | Pendiente |
| R5 | **Botón "Estoy vendiendo ahora" (confirmación proactiva)**. Hoy el vendedor solo responde preguntas; no puede avisar por su cuenta que abrió. Es la función más valiosa según el análisis competitivo. | Frescura del dato y acción principal del vendedor | **Nuevo: no existe** |
| R6 | Panel de administrador, fase 1 (negocios pendientes con la API nueva y auditoría) | **El piloto** (no la integración) | Pendiente |
| R7 | Editar negocio y horario después del registro | Perfil del vendedor completo | Pendiente |
| R8 | Botón "Limpiar búsqueda" en `/buscar` | Acción del ancla en Buscar | Pendiente |
| R9 | Hoja de búsqueda a 320 px | Pantallas pequeñas | Hipótesis sin verificar |

---

## 3. Lo que se trae de la demo además del ancla

En la prueba manual, la demo se percibe más pulida que RUTEANDO. Se traen estas piezas, que sirven con o sin ancla:

- Hojas inferiores que reservan la franja del lado del ancla (HM-07) y suben sobre el teclado (HM-05).
- Banda de etiqueta única y legible (HM-02).
- Aviso con "Deshacer" (C-03, C-21).
- Frescura del dato en pines y tarjetas ("confirmado hace X").
- Hoja del negocio con acciones claras y "Ver perfil completo".
- Zoom de un dedo en el mapa (HM-18), útil aunque el ancla esté apagada.
- Métricas locales opcionales para las pruebas con personas.

---

## 4. Acciones por pantalla y rol

Convención: **90°** es la posición de arriba (volver o inofensiva). P1 a P4 van de la posición más cómoda (diagonal) a la menos cómoda. "Ocultar teclado" lo agrega el sistema a 180° cuando hay teclado (HM-06). "Deshacer" ocupa P1 mientras está visible (C-21). Máximo 5 opciones en total.

### 4.1 Mapa (`/`, `/mapa`) — todos los roles con sesión

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Mapa | Mi ubicación | Buscar | Favoritos | Mi perfil / Mi negocio | Zoom |

- **Joystick:** mueve el mapa (HM-11); apuntar y elegir pines y grupos (HM-12a).
- **Decisión DI-03:** hoy la navegación flotante tiene "Perfil". Con Zoom (pedido por 2 de 2 personas) no cabe "Disponibles ahora" ni "Ofertas cerca"; quedan en el carrusel superior y en "Ver todas". Alternativa: cambiar Favoritos por "Disponibles ahora".

**Capas del mapa**

| Capa | Centro | Acciones |
|---|---|---|
| Hoja de búsqueda | Lupa, "Buscar" | Limpiar búsqueda · Solo abiertos (interruptor) · Sencilla/Avanzada |
| Resumen del negocio (pin elegido) | Ícono de su categoría + nombre | Carta/Productos/Servicios · Cómo llegar · WhatsApp (si tiene) · Favorito · botón "Ver perfil completo" |
| Lista filtrada | Ícono de la pestaña | Cambiar pestaña · Ver en el mapa · apuntar y elegir filas |
| Grupo de pines | "N negocios" | Lista del grupo con apuntar y elegir |

### 4.2 Buscar (`/buscar`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Lupa, "Buscar" | Volver al mapa | Limpiar búsqueda (R8) | Solo abiertos | Sencilla/Avanzada | Favoritos |

Joystick: desplaza la lista; apuntar y elegir tarjetas.

### 4.3 Perfil de negocio — visitante o consumidor (`/negocios/[id]`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| Ícono de su categoría + nombre | Volver | WhatsApp | Cómo llegar | Favorito | Preguntar si está vendiendo |

- "Preguntar si está vendiendo" hoy no se puede cancelar: en el ancla es **irreversible** (deslizar más allá). **DI-04:** agregar "cancelar pregunta" en el backend para volverla reversible.
- Joystick: desplaza la página; apuntar y elegir filas de la carta (se expanden).
- Zonas: "Volver" (arriba izq.) y corazón (arriba der.) son preferidas; los botones flotantes de hoy desaparecen con el ancla encendida.

### 4.4 Perfil de negocio — dueño (inicio del vendedor)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| "Mi negocio" | Ir al mapa (inofensiva) | **Estoy vendiendo ahora** (R5) | ¿Qué se acabó? (R3) | Ubicación en vivo (solo ambulante) | Publicar oferta |

- **Preguntas pendientes:** cuando hay preguntas de disponibilidad sin responder, "Responder (N)" toma P1 temporalmente, igual que Deshacer.
- **¿Qué se acabó?** abre una capa con la lista de productos e interruptores Disponible/Agotado, con apuntar y elegir. Cada cambio ofrece Deshacer.
- **Publicar oferta** abre el formulario de producto que ya existe, con la casilla "Es una oferta con vigencia" encendida (sugerencia del backlog).
- **Ubicación en vivo:** encender y apagar son reversibles; el consentimiento de la primera vez sigue siendo el modal actual.
- Para vendedores de puesto fijo o local, P3 pasa a "Editar horario" (R7).

### 4.5 Cuenta y perfil del consumidor (`/perfil`, `/cuenta`)

| Centro | 90° | P1 | P2 | P3 | P4 |
|---|---|---|---|---|---|
| "Mi cuenta" | Volver al mapa | Mis reseñas | Configuración | Favoritos | — |

Regla: **las acciones críticas de la cuenta no van en el ancla** (cambiar contraseña, eliminar cuenta, retirar consentimientos). Se hacen solo con la interfaz normal y su confirmación.

### 4.6 Asistente de registro (`/negocios/nuevo`)

| Centro | 90° | P1 | P2 |
|---|---|---|---|
| "Nuevo negocio · paso N de 3" | Paso anterior | Siguiente paso | Salir (irreversible → `ConfirmSheet`) |

Con teclado: "Ocultar teclado" a 180°.

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
| Mapa | Crédito de OpenStreetMap | Logo "Ruteando", botones +/− de zoom, tarjeta de comparación de zonas |
| Perfil de negocio | Crédito OSM del mapa chico (dueño) | "Volver", corazón o engranaje |
| Todas | Áreas seguras del sistema | — |

Con el ancla apagada, la navegación flotante vuelve a su lugar; su choque con el crédito OSM ya queda resuelto por R2.

---

## 6. Íconos a registrar o revisar

| Significado | Ícono propuesto | Nota |
|---|---|---|
| Cerrar capa | `X` | Nuevo |
| Deshacer | `ArrowCounterClockwise` | Nuevo |
| Agotado / no disponible | `MinusCircle` | Nuevo; `Prohibit` ya significa otra cosa |
| Estoy vendiendo ahora | Por decidir | **DI-06**; no reutilizar `DoorOpen` ("abierto según el horario") ni `SealCheck` si ya tienen otro significado |
| Marcar favorito / lista de Favoritos | `Heart` / `ListHeart` | Hoy `Heart` se usa para las dos cosas |
| Secciones de perfil | `IdentificationCard` | No usar `Storefront` (significa puesto o local) |
| Zoom | Por decidir | El que usa la demo |

---

## 7. Plan por etapas

Cada etapa termina con pruebas automáticas y **prueba manual en PC y celular** antes de la siguiente.

| Etapa | Contenido | Criterio de salida |
|---|---|---|
| I0 | Prerrequisitos R1 a R5 y R8 (R6 y R7 en paralelo, porque bloquean el piloto, no la integración) | Cada uno fusionado con sus pruebas |
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

## 9. Decisiones pendientes

| ID | Pregunta | Propuesta |
|---|---|---|
| DI-01 | ¿Cómo llega el código del ancla a RUTEANDO? | Dependencia de Git con etiqueta de versión; si da problemas con el monorepo, GitHub Packages |
| DI-02 | Orden real de capas (z-index) en RUTEANDO | Verificar en el código antes de I1 |
| DI-03 | ¿Qué opciones van en el mapa? | Mi ubicación · Buscar · Favoritos · Mi perfil · Zoom |
| DI-04 | ¿Se puede cancelar "Preguntar si está vendiendo"? | Agregarlo en el backend para volverla reversible |
| DI-05 | ¿Ancla en el panel de administrador? | No en esta integración; revisar con el panel terminado |
| DI-06 | Ícono de "Estoy vendiendo ahora" | Elegirlo al construir R5 |
| DI-07 | ¿El vendedor con ancla apagada ve "Estoy vendiendo ahora" como botón fijo? | Sí: la función debe existir sin el ancla (principio 1) |

---

## 10. Riesgos

- **Exposición del vendedor:** "Estoy vendiendo ahora" y la ubicación en vivo lo hacen visible. El vendedor siempre decide qué y cuándo se ve.
- **Demasiados modos:** con joystick, apuntar, capas y descanso, hay que medir con personas si alguien se pierde. El modo "Solo menú" es la salida simple.
- **Dos repos en paralelo:** un cambio en el ancla puede romper RUTEANDO. Por eso RUTEANDO usa versiones fijas y sube de versión a propósito.
- **Datos que asume este documento:** todo lo que viene del inventario puede tener errores (ya pasó con offerTypeId). Se verifica en el código antes de cada etapa.
