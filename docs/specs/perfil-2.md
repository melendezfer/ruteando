# Perfil 2.0 — especificación

Versión 0.1 · 2026-09-28 · Estado: **especificación para revisión, sin código**

Origen: pedido directo del usuario (boceto aprobado, descrito en texto) y hallazgos de su revisión en celular. Sin RF asociado: reorganiza pantallas que ya existen (Épicas F4, F5, F6, CLAUDE.md §17, §20, §30–§44, §53–§59) y cierra los prerrequisitos del ancla R3, R7, R10 y R12 (`docs/integracion-ancla.md` §2).

> Lo que este documento afirma sobre el código actual se revisó leyendo `develop` (commit `4668e3a`) el 2026-09-28. Las cifras de contraste se calcularon con un programa (§2.3). Lo que no se probó con la app corriendo va marcado como **hipótesis sin verificar**.

**Objetivo de siempre: práctico, ágil, limpio y organizado.** Principio de esta spec: **divulgación progresiva** — primero lo necesario, el resto a la mano, desplegándose en el mismo lugar (acordeón u hoja inferior), nunca en una pantalla nueva sin necesidad.

---

## 1. Qué cambia, en una tabla

| Pantalla | Hoy | Perfil 2.0 |
|---|---|---|
| Perfil del negocio (cliente) | Portada alta, insignias una por línea en celular, carta plana, calificar al final, 3 botones flotantes que tapan contenido | Portada baja, estado arriba, "Cómo comprar" en cuadrícula, carta por secciones, "Más información" en acordeones, **sin botones flotantes** |
| Perfil del negocio (dueño) | La misma pantalla, con ~12 tarjetas de ajustes apiladas debajo | Tres pantallas: **Tablero del día** (inicio), **Ajustes del negocio** (engranaje) y **Ver como cliente** |
| Hoja resumen del mapa | Horario con ícono de ubicación, enlaces de texto | Estado, horario (reloj) y tres acciones: Carta, **Cómo llegar** (principal), WhatsApp |
| Colores | Morado + naranja/turquesa/morado por familia de categoría + verde/ámbar/rojo | Una sola familia morada con tintes; verde, ámbar y rojo solo como estados, en versión suave |

Familias de información (se usan en las tres pantallas): **Estado de hoy**, **Vitrina y carta**, **Cómo comprar**, **Ubicación**, **Confianza**, **Identidad**. Aparte: **Mi cuenta** y **Herramientas**.

---

## 2. Paleta de color (Parte B)

### 2.1 Regla

Una sola familia: el morado de la marca (token `terracota`, `#5b3df5`; oscuro `terracota-dark`, `#4830c2`) y sus tintes suaves. Todo limpio, tenue y agradable.

| Grado | Uso | Estilo |
|---|---|---|
| 1 | **Acción principal** de la pantalla (una sola por pantalla) | Morado sólido, texto blanco |
| 2 | Acciones secundarias | Borde morado o tinte morado suave, texto morado |
| 3 | Acciones terciarias (enlaces, "ver más") | Solo texto morado |
| — | Todo lo demás | Neutros: blanco, `surface`, `background`, grises del tema |

Estados que conservan color, **siempre en versión suave** (fondo tenue + texto oscuro del mismo tono):

| Estado | Significa | Fondo | Texto |
|---|---|---|---|
| Verde | Vendiendo / abierto / disponible | `verde-suave` | `verde-texto` |
| Ámbar | Pendiente / agotado / aviso | `ambar-suave` | `ambar-texto` |
| Rojo | **Solo** acciones destructivas (eliminar, borrar foto, eliminar cuenta) | `rojo-suave` | `rojo-texto` |

`mostaza` (círculos de zona en el mapa) y el azul del punto "mi ubicación" se quedan: son marcas del mapa, no de la interfaz.

### 2.2 Tokens (todos en `client/src/app/globals.css`, sin colores escritos a mano)

| Token | Valor | Uso |
|---|---|---|
| `terracota` | `#5b3df5` | Grado 1, texto y bordes morados |
| `terracota-dark` | `#4830c2` | Presionado/hover del grado 1 |
| `terracota-50` | `#efebfe` | Fondo del grado 2, tinte de íconos de categoría |
| `terracota-100` | `#dfd8fd` | Borde suave, tinte de portada sin foto (nunca con texto encima, ver §2.3) |
| `borde-control` | `#8c8c8c` | Borde de campos y controles (3:1); ya lo agrega A9 |
| `estrella` | `#b0701a` | Estrellas de calificación e íconos dorados (3:1); ya lo agrega A9 |
| `verde-suave` / `verde-texto` | `#e8f5e9` / `#1b5e20` | Estado verde |
| `ambar-suave` / `ambar-texto` | `#fff4e0` / `#7a4a00` | Estado ámbar |
| `rojo-suave` / `rojo-texto` | `#fdecec` / `#b3261e` | Destructivo |

Se retiran de la interfaz: los tres colores por familia de categoría (`categorias.color`, sección 2.4) y `bg-verde` sólido (insignia "Abierto ahora" de la portada). `text-ambar` sobre `bg-ambar/20` ("No disponible" en la carta) ya lo retira A9.

### 2.3 Contraste (AA: texto 4.5:1, íconos y bordes 3:1)

**Calculado con un programa**, no a mano (fórmula de luminancia relativa de WCAG 2.x; los tintes con transparencia, como `bg-ambar/20`, se mezclan sobre el fondo real antes de medir). La misma tabla la comprueba una prueba automática (ver el final de esta sección).

| Par | Relación | Resultado |
|---|---|---|
| Blanco sobre `terracota` (botón principal) | 6.12:1 | Pasa texto AA |
| `terracota` sobre blanco (texto, borde, ícono) | 6.12:1 | Pasa texto AA |
| `terracota` sobre `terracota-50` | 5.24:1 | Pasa texto AA |
| `terracota` sobre `terracota-100` | 4.48:1 | **No pasa texto AA** → `terracota-100` solo para fondos sin texto y bordes |
| Blanco sobre `terracota-dark` | 8.48:1 | Pasa texto AA |
| `verde-texto` sobre `verde-suave` | 7.00:1 | Pasa texto AA |
| `ambar-texto` sobre `ambar-suave` | 6.86:1 | Pasa texto AA |
| `rojo-texto` sobre `rojo-suave` | 5.72:1 | Pasa texto AA |
| `rojo-texto` sobre blanco | 6.54:1 | Pasa texto AA |
| `text-muted` (`#555555`) sobre blanco / `background` | 7.46:1 / 7.14:1 | Pasa texto AA |
| `borde-control` (`#8c8c8c`, nuevo) sobre blanco / `background` | 3.36:1 / 3.22:1 | Pasa 3:1 (bordes de controles) |

**Hallazgos de la app de hoy, medidos con el mismo programa:**
- "No disponible" en la carta: `text-ambar` (`#f9a825`) sobre `bg-ambar/20` = **1.73:1**. No pasa AA. Se corrige en el arreglo A9 (`fix/pulido-visual`), antes de esta paleta.
- Borde de los campos de texto (`border-border`, `#e0e0e0`) sobre blanco = **1.32:1**. WCAG 1.4.11 pide 3:1 para el borde que identifica un control. Se corrige en A9 con el token `borde-control`. Los bordes de tarjetas son decorativos y pueden seguir en `border`.
- Pasan hoy: el verde de "Abierto ahora" (5.13:1), el rojo de error (5.62:1) y las insignias moradas sobre `terracota/10` (5.28:1).

Prueba automática: `tests/unit/contrasteTokens.test.js` (A9, PR #94) lee los tokens de `globals.css`, calcula cada par y falla si alguno baja de su umbral; corre en CI con la suite del backend. Al agregar un token o un par, se agrega a esa prueba.

**Encontrado al medir en A9, ya corregido allí:** estrellas de calificar en `mostaza` (2.10:1; los íconos piden 3:1) → token `estrella` (`#b0701a`, 4.06:1); verde sobre `verde/10` (4.49:1) → token `verde-texto` (`#1b5e20`). Esta paleta los hereda.

### 2.4 Categorías y pines sin colores por familia

**Propuesta para íconos de categoría fuera del mapa** (filas, tarjetas, perfil): ícono **morado sobre tinte** (`terracota` sobre `terracota-50`), círculo de 36 px. Es grado 2: se ve, pero no compite con la acción principal.

**Propuesta para los pines del mapa:**
- Pin: gota **morada sólida con ícono blanco** (la categoría se reconoce por el ícono).
- Grupos de pines: círculo **blanco con borde morado y número morado** — hoy son morados sólidos y se confundirían con un pin.
- Modalidad: la marca chica abajo a la derecha se queda (carrito / sombrilla / local).
- **"Vendiendo ahora" (R12):** marca chica **verde suave con `SealCheck`** arriba a la izquierda del pin, y el pin un poco más grande. Es el único color de estado en el mapa, así que se lee de lejos.
- Ubicación en vivo: el anillo que pulsa se queda, en morado.

**Qué se pierde en el mapa:** hoy el color de familia deja ver de un vistazo "dónde hay comida y dónde hay servicios" sin leer íconos; con todo morado, esa lectura pasa al ícono, que a zoom lejano mide ~14 px.

**Recomendación:** adoptar la paleta morada también en el mapa. Razones: (1) la identidad ya la carga el ícono desde el PR 3 de íconos; (2) el color de estado "vendiendo ahora" solo destaca si es el único color del mapa; (3) los chips de categoría de la búsqueda ya filtran por familia. Medirlo en las pruebas con personas (etapa I6 del ancla): si alguien no encuentra la comida en el mapa, volver a un tinte por familia **solo en los pines**. `categorias.color` se conserva en la base (sin migración) para ese caso.

---

## 3. C1 — Perfil del negocio (cliente)

Ruta: `/negocios/[id]` (sigue siendo SSR por la vista previa de WhatsApp, CLAUDE.md §12). De arriba a abajo:

### 3.1 Encabezado (visible sin desplazar en 390×844)

1. **Portada baja**, ~1/3 de la pantalla (260 px en 844). Sin foto: el ícono de categoría grande sobre `terracota-50`. Encima, fijo: solo **Volver** (arriba a la izquierda). **Favorito** va junto al nombre (sin sesión no aparece) — arriba no hay íconos de acción (§8.1).
2. **Estado**, una línea, en este orden de prioridad:
   - "Vendiendo ahora · confirmado hace X" (`SealCheck`, verde suave) — R5;
   - ambulante dentro de una franja: "Ahora por: Salida del colegio" (`ShoppingCartSimple`);
   - "Abierto hasta las 8:00 p. m." (`DoorOpen`, verde suave);
   - "Abre hoy a las 5:00 p. m." / "Cerrado hoy · abre el lunes" (ámbar suave).
3. **Nombre** (título 1).
4. **Categoría · modalidad · distancia** (una línea, texto suave): "Arepas · En la calle · 250 m".
5. **Horario de hoy** (`Clock`): "Hoy 8:00 a. m. – 8:00 p. m.".
6. **Referencia** (`MapPin`): "Frente al parque de la Cra 33".
7. **Descripción corta**: máximo ~120 caracteres visibles; si es más larga, "… ver más" la despliega en el mismo lugar.
8. **Cómo comprar** — cuadrícula 2×2, botones de 48 px de alto:
   - **Cómo llegar** (grado 1, morado sólido) — a la ubicación efectiva (en vivo > franja > base), igual que hoy;
   - **WhatsApp** (grado 2) — registra `clic_contacto` (y `clic_como_llegar` para el otro, sección 7);
   - **Domicilio propio** (grado 2, solo si `ownDelivery`) — despliega "zona y costo" del acordeón de domicilios;
   - **Medios de pago** (grado 2) — "Efectivo · Nequi" (sección 7.3).
   - Si falta un dato (sin teléfono, sin domicilios), el espacio lo ocupa el siguiente; con solo dos acciones, una fila de dos.
9. **Insignias restantes** en una sola línea que fluye (bancas, higiene autodeclarada): chips pequeños grado 2; la de higiene sigue abriendo su aclaración legal (CLAUDE.md §30).

Presupuesto vertical en 390×844 (sin la barra del navegador): portada 260 + estado 24 + nombre 30 + meta 20 + horario 20 + referencia 20 + descripción 40 + cuadrícula 104 + insignias 28 + márgenes ~90 = **~636 px**. Cabe con ~200 px de margen. A 320 px de ancho la cuadrícula queda en dos columnas de 136 px; los textos de los botones se acortan ("Llegar", "WhatsApp", "Domicilio", "Pago").

### 3.2 Hoy destacado

- Primero la **oferta vigente** (si hay), con su tipo (ícono propio) y "hasta las X".
- Luego hasta **3 destacados** que elige el vendedor.
- Fila horizontal que el usuario desliza a mano. **Sin carrusel automático.**
- Sin ofertas ni destacados, la sección no aparece.

### 3.3 Carta

- Secciones plegables: "Arepas · 3", "Bebidas · 2". Abiertas por defecto si son ≤ 2 secciones; si hay más, solo la primera.
- Fila corta: nombre, precio y estado ("Disponible" / "Agotado"; el tiempo solo si cambió hoy — "Agotado desde las 11:00 a. m.", mismo criterio que A7).
- Tocar una fila la expande en el mismo lugar: foto y descripción (evento `vista_producto`, sin cambios).
- **"Agotado hoy"** va al final, atenuada.
- Rótulo según la categoría, sin cambios: Carta / Productos / Servicios.

### 3.4 Más información (acordeones, todos cerrados al entrar)

1. **Horario de la semana** (y franjas del ambulante).
2. **Dónde encontrarlo**: mapa chico, referencia, "Cómo llegar".
3. **Domicilios**: zona y costo (solo si `ownDelivery`).
4. **Higiene**: la declaración y su aclaración legal completa.
5. **Reseñas y calificar**: promedio, número y el formulario de calificar (sin sesión: "Inicia sesión para calificar").
6. **Reportar información desactualizada** (RF-025, ya existe en el backend; hoy **no tiene interfaz**: hipótesis sin verificar, leída en el código).

### 3.5 Reglas

- **Sin botones de acción flotantes en el perfil**: sus acciones ya están en "Cómo comprar". "Volver al mapa" pasa a ser el botón Volver. Con sesión queda la columna de navegación de toda la app (§8.1).
- **Visitante sin sesión:** sin Favorito, sin "¿Está vendiendo ahora?" y sin calificar (ver "Inicia sesión" dentro del acordeón).
- **El dueño que abre su propio perfil** ve la vista de cliente con una franja arriba: "Así ven tu negocio tus clientes · Volver a mi tablero".

---

## 4. C2 — Tablero del día (inicio del vendedor)

Ruta: la de hoy para el vendedor con negocio activo (CLAUDE.md §38/§43), `/negocios/[id]` con sesión de dueño → pasa a `/tablero` (nueva). `/perfil` sigue llevando al vendedor a su tablero.

### 4.1 Encabezado

"Domingo 28 · 6:30 p. m." — "Mis negocios de hoy" ("Mi negocio hoy" con uno solo). **Ajustes del negocio** va como botón con texto dentro del contenido (no un engranaje arriba: §8.1).

### 4.2 Varios negocios: AHORA y DESPUÉS

- **AHORA**: tarjeta destacada del negocio cuyo horario (o franja) cubre la hora actual. Si varios coinciden, el que tenga aviso "vendiendo" vigente; si no, el que abrió primero.
- **DESPUÉS**: los demás negocios con horario más tarde hoy, en orden de hora ("Tintos · 5:00 a. m.", "Dulces · 12:00 p. m.", "Chorizos · 5:00 p. m."). Los que ya cerraron hoy van al final, atenuados.
- Un solo negocio: sin estas etiquetas, solo su tarjeta.

**Evaluación: "varios negocios" (como hoy) vs. "un negocio con varios turnos".**

| | Varios negocios | Un negocio con varios turnos |
|---|---|---|
| Categoría, carta y fotos distintas por turno (tintos vs. chorizos) | Sí, cada uno tiene las suyas | No: una sola categoría y carta |
| Aparece en el mapa con el ícono correcto en cada momento | Sí | No (un solo ícono) |
| Ubicación distinta por hora | Sí, y además cada uno puede tener franjas | Sí, ya existe con franjas |
| Reseñas y estadísticas | Separadas por lo que vende | Mezcladas |
| Costo de construir | Cero (ya existe) | Rehacer categoría/carta por turno |

**Recomendación: varios negocios.** Cuando lo que se vende es distinto, son negocios distintos para el cliente. Cuando lo que se vende es lo mismo y solo cambia el lugar, ya existe la herramienta: **franjas por hora** en un solo negocio. El tablero junta ambos casos en una vista del día.

### 4.3 Tarjeta del negocio de ahora

- Estado R5: "Estás vendiendo · se vence en 42 min" con **Sigo vendiendo** (grado 1) y **Ya no vendo** (grado 2). Sin aviso: **Estoy vendiendo ahora** (grado 1).
- Es la única acción principal de la pantalla.

### 4.4 Tu semana (nuevo)

Cuatro cifras, últimos 7 días contra los 7 anteriores (flecha y diferencia):

| Cifra | Fuente |
|---|---|
| Visitas al perfil | `eventos` tipo `vista_negocio` |
| Contactos | `clic_contacto` (WhatsApp) + `clic_como_llegar` (nuevo, sección 7.4) |
| Calificación | Promedio con estrellas y número de calificaciones aprobadas |
| Reseñas pendientes de revisión | Reseñas del negocio en `estado_moderacion = 'pendiente'` |

Solo cifras agregadas, nunca quién visitó. Sin datos suficientes: "Todavía no hay datos de esta semana".

**Evidencia para R6** (panel de moderación): en la base de desarrollo hay una reseña en "Pendiente de revisión" desde el 14/09 porque no existe pantalla para moderarla (reportado por el usuario en su revisión en celular). Esta cifra la mostraría al vendedor, pero solo un moderador puede resolverla: R6 bloquea que la cifra baje.

### 4.5 Pendientes

- Preguntas de disponibilidad sin responder, cada una con **Responder** (sí / no), igual que el panel actual.
- Avisos importantes: teléfono sin verificar, negocio pendiente o rechazado, oferta por vencer hoy.

### 4.6 ¿Qué se acabó? (R3)

Lista de productos con un interruptor **Disponible / Agotado** por fila (un toque, reversible, con aviso "Deshacer" cuando exista R4). Al final, **Agregar producto**.

### 4.7 Atajos

**Publicar oferta** (abre el formulario de producto actual con la casilla "Es una oferta con vigencia" encendida) y **Ver como cliente** (abre el perfil C1 con la franja de §3.5).

---

## 5. C3 — Ajustes del negocio (engranaje)

Familias plegables. Cada una cerrada muestra **una línea de resumen** ("Identidad · Arepas Doña Rosa · Arepas"); al abrirla, sus controles. Los controles que ya existen se mueven aquí sin cambiar su lógica.

| Familia | Contenido | Hoy |
|---|---|---|
| **Identidad** | Nombre, categoría, descripción (contador 120 visibles / 500 máx.), foto con guía corta ("De día, de frente, que se vea lo que vendes") | Solo la foto se edita después del registro — **R7** |
| **Cómo comprar** | Domicilios propios (+ zona y costo), bancas, medios de pago (Efectivo, Nequi, Daviplata, Transferencia), WhatsApp del negocio | Domicilios y bancas existen; zona/costo, medios de pago y editar WhatsApp son nuevos |
| **Ubicación** | Modalidad (Ambulante / En la calle / Local), mapa con pin, referencia editable **junto al mapa**, privacidad (zona aproximada / punto exacto), puntos por hora (ambulante), ubicación en vivo (ambulante) | Todo existe salvo editar la referencia |
| **Horario** | Horario por día, editable | Solo en el registro — **R7** |
| **Confianza** | Higiene autodeclarada (con su guía), verificación de teléfono | Existe |
| **Herramientas** | Código QR, ideas de clientes (retroalimentación privada) | Existe |

Al final, aparte: **Mi cuenta: datos personales y contraseña** (`/cuenta`).

**Referencia al mover el pin.** Si el pin se mueve más de ~30 m de la ubicación guardada, antes de guardar aparece: "Moviste tu punto 120 m. ¿Cambió tu referencia?" con el texto actual listo para editar y dos botones: **Guardar** (grado 1) y **Sigue igual** (grado 2). Hoy el editor de pin conserva la referencia sin preguntar (CLAUDE.md §44).

---

## 6. C4 — Hoja resumen del mapa

Al tocar un pin:
- Estado (misma regla que §3.1) y horario de hoy con **reloj** (hoy usa `MapPin`: corregido en A4).
- Tres acciones: **Carta** (grado 2, abre el perfil en la carta), **Cómo llegar** (grado 1), **WhatsApp** (grado 2, solo si tiene teléfono) — **R10**.
- **Ver perfil completo** (grado 3).

---

## 7. Backend nuevo

Todo con migración versionada, `openapi.yaml`, validación en servidor y autorización a nivel de objeto (solo el dueño escribe).

### 7.1 Secciones y orden de la carta

- Tabla `secciones_carta` (`id`, `negocio_id`, `nombre` ≤ 40, `orden`), única por (`negocio_id`, `nombre`).
- `productos.seccion_id` (nullable → "Otros") y `productos.orden`.
- Rutas: `GET/PUT /businesses/{id}/menu-sections` (reemplazo completo, como el horario) y `PATCH /products/{id}` acepta `sectionId` y `order`.
- `productos.categoria_id` (global, hoy siempre `null` desde la interfaz) no se reusa: una sección es del vendedor, no del catálogo global.

### 7.2 Destacados

- `productos.destacado BOOLEAN NOT NULL DEFAULT false`, máximo 3 por negocio (409 al cuarto, validado con lock por negocio).
- No cuenta contra el límite de catálogo gratis (CLAUDE.md §55): es una marca, no un producto nuevo.

### 7.3 Medios de pago y domicilios

- ENUM `medio_pago` (`efectivo`, `nequi`, `daviplata`, `transferencia`); `negocios.medios_pago medio_pago[] NOT NULL DEFAULT '{efectivo}'`. Con el mismo cuidado de cast que `etiquetas` de reseñas (CLAUDE.md §26: `::medio_pago[]` al escribir, `::text[]` al leer).
- `negocios.domicilio_zona TEXT` (≤ 120) y `negocios.domicilio_costo INTEGER` (pesos, nullable = "a convenir").
- Ninguno es obligatorio en el registro (RNF-013: registro en menos de 10 minutos).

### 7.4 Estadísticas agregadas

- `tipo_evento` suma `clic_como_llegar` (hoy "Cómo llegar" no registra nada: hipótesis sin verificar, leída en el código).
- `GET /businesses/{id}/stats?days=7` — solo el dueño. Devuelve `{ current: {...}, previous: {...} }` con `profileViews`, `contacts`, `averageRating`, `ratingCount`, `pendingReviews`. Solo conteos; nunca `usuario_id` ni IP.
- Consulta sobre `eventos` por (`negocio_id`, `tipo`, `fecha`): índice nuevo `idx_eventos_negocio_tipo_fecha`. Prueba de plan de ejecución, como en `nearbyIndexPlan.test.js`.

### 7.5 Negocios de hoy

- `GET /users/me/businesses` ya existe; suma `todaySchedule` y `nextOpenAt` por negocio para ordenar AHORA / DESPUÉS en el servidor (una sola regla de horario, `condicionRangoHorarioSQL`), no en el navegador.

---

## 8. Accesibilidad y pantallas pequeñas

- Objetivos táctiles de **44×44 px** como mínimo (hoy hay botones de 36 px: los íconos de editar/borrar producto y "Cómo llegar" en la lista del mapa).
- Contraste AA con la tabla de §2.3.
- **320 px**: sin desplazamiento horizontal; la cuadrícula "Cómo comprar" en 2 columnas con textos cortos; insignias que fluyen.
- Cada acordeón y sección plegable: `button` con `aria-expanded` y `aria-controls`.
- Estados con texto, nunca solo con color ("Vendiendo ahora", "Agotado").
- Movimiento: nada se desliza solo; `prefers-reduced-motion` respetado.

---

### 8.1 Navegación: encabezado y columna derecha (Etapa 1b, 2026-10-03)

Pedido del usuario; el mismo lugar que ocupará el botón-ancla (`docs/integracion-ancla.md` §5.1, DI-08).

- **Arriba** solo "Volver" y el título (`ScreenHeader`), donde haga falta: Buscar, Mi cuenta, Mi perfil, Ajustes. El mapa no lleva encabezado (carrusel arriba); el perfil del negocio, solo "Volver" sobre la portada. Ningún ícono de acción arriba: Favorito va junto al nombre, Ajustes del negocio como botón con texto, Cerrar sesión al final de la cuenta.
- **Columna derecha, zona media-baja**, siempre en el mismo orden: Buscar, Favoritos, Perfil y, al final, **el mapa** — "Ubicarme" en el mapa, "Mapa" en cualquier otra pantalla. Regla (2026-10-03): con sesión, volver al mapa está siempre a un toque y en el mismo lugar, en todas las pantallas del consumidor y del vendedor (incluidos Ajustes, el asistente de registro y los textos legales). Botones de 44 px, a 12 px del borde, borde inferior a `18vh` + área segura. Sin letreros a la vista: el nombre aparece al mantener presionado (táctil) o al pasar el mouse (PC).
- **Aviso de la primera vez**: pequeño ("Mantén pulsado para ver el nombre"), dentro de la franja reservada encima de la columna, no tapa contenido ni bloquea toques, y se cierra con cualquier toque en la pantalla.
- **Franja reservada** (`.reserva-columna`, 64 px): el contenido, las hojas del mapa y los avisos (tarjeta de zonas) la dejan libre; nada queda debajo de la columna en ninguna posición del desplazamiento. Excepción: la portada del perfil (foto, sin texto ni controles).
- **Hoja o teclado abiertos**: un solo botón, "Volver al mapa", en el mismo lugar que el último de la columna (en el mapa cierra la hoja).
- **Sin sesión** (enlace compartido): solo "Volver"; la columna no aparece.
- **WhatsApp y Cómo llegar** dejan de ser flotantes: van en el contenido del perfil, debajo de las insignias (adelanto de "Cómo comprar", §3.1).

## 9. Pruebas

- **Backend:** secciones (CRUD, orden, autorización 401/403/404), destacados (tope 3, concurrencia), medios de pago (validación del ENUM), estadísticas (conteos correctos, comparación de semanas, sin datos personales, 403 a otro vendedor, plan de ejecución con índice), negocios de hoy (orden AHORA/DESPUÉS con horarios nocturnos).
- **Interfaz (Playwright contra el servidor real):**
  - C1 en 390×844: estado, nombre, meta, horario, referencia, descripción y "Cómo comprar" visibles sin desplazar;
  - C1 sin sesión: sin Favorito, sin preguntar, sin calificar;
  - ningún botón flotante tapa texto ni un control (la prueba de A1, ampliada a todas las pantallas nuevas);
  - C2 con un vendedor de dos negocios: AHORA/DESPUÉS en el orden correcto;
  - C3: aviso de referencia al mover el pin > 30 m;
  - contraste de tokens (§2.3);
  - 320 y 412 px: sin desplazamiento horizontal.
- **Manual:** PC y celular (Nubia) en cada entrega, con guía en `docs/pruebas/`.

---

## 10. Cómo encaja con el botón-ancla

Todo funciona sin el ancla (principio 1 del plan). Con el ancla encendida:

- **Acciones del dueño** (abanico del Tablero): Estoy vendiendo / Sigo vendiendo (R5), ¿Qué se acabó? (capa con los interruptores de §4.6), Responder (N) (toma P1 mientras haya preguntas), Publicar oferta, Ver como cliente.
- **Secciones que recorre el joystick** en el perfil: Estado → Cómo comprar → Hoy destacado → Carta (cada sección) → Más información (cada acordeón). En el tablero: AHORA → Tu semana → Pendientes → ¿Qué se acabó?.
- **Capa de producto**: al apuntar una fila de la carta, el abanico ofrece Ver foto/descripción (expande en el mismo lugar) y, para el dueño, Disponible/Agotado y Editar.
- Las acciones de "Cómo comprar" son las mismas del abanico del cliente (`docs/integracion-ancla.md` §4.3), así que el ancla no necesita pantallas nuevas.

---

## 11. Entregas

1. **Paleta** (tokens + contraste + reemplazos de estados), sin cambiar pantallas.
2. **C1 Perfil del cliente** (sin backend nuevo, salvo `clic_como_llegar`).
3. **C3 Ajustes** con R7 (editar identidad y horario) + medios de pago y domicilios.
4. **C2 Tablero** con R3, estadísticas y negocios de hoy.
5. **Carta por secciones y destacados** (§7.1–7.2).
6. **C4 Hoja resumen** con R10 y pines con R12.

Cada entrega: su rama desde `develop`, pruebas, guía de prueba manual y **prueba del usuario antes de fusionar**. Empieza después de que el usuario pruebe R5 (PR #93).

---

## 11.1 Avance

- **Etapa 1 (2026-09-29, `feature/perfil-2-ajustes`)**: paleta (entrega 1) y C3 Ajustes con R7 (identidad y horario), WhatsApp editable y referencia junto al mapa. Medios de pago y zona/costo de domicilio pasan a la Etapa 3 (con C1). Detalle: CLAUDE.md §63.
- **Etapa 1b (2026-10-03, misma rama)**: navegación §8.1 (encabezado "Volver" + título, columna derecha, franja reservada, un solo botón con hoja o teclado). Pruebas a 360, 390 y 412 px: `client/e2e/columna-navegacion.spec.ts` y `flotantes-no-tapan.spec.ts`.
- **Etapa 2 (2026-10-03, `feature/perfil-2-tablero`)**: C2 tablero del día en `/tablero` (página principal del vendedor con negocio: `/` y `/perfil` llevan ahí), con AHORA/DESPUÉS, "Tu semana" (§4.4), pendientes, "¿Qué se acabó?" (R3) y atajos; `clic_como_llegar` registrado en todos los "Cómo llegar". Desviaciones, a propósito: (1) "AHORA/DESPUÉS" sale de un endpoint nuevo, `GET /users/me/businesses/today`, no de sumar campos a `GET /users/me/businesses` — ese pagina por fecha de creación (cursor keyset) y este orden no se puede paginar; (2) `pendingReviews` va aparte de `current`/`previous` (es lo que espera revisión hoy, no una cifra por semana); (3) tocar un negocio de DESPUÉS lo pasa a la tarjeta principal del tablero (para gestionarlo sin salir). Pendiente de §4.5: "oferta por vencer hoy" sí; el resto de avisos importantes (rechazado, suspendido) se ven con el mismo `BusinessStatusBanner` de la tarjeta. Detalle: CLAUDE.md §64.

## 12. Decisiones pendientes

| ID | Pregunta | Propuesta |
|---|---|---|
| P2-01 | ¿Pines morados o con tinte por familia? | Morados (§2.4), **aplicado en la Etapa 1**; revisar en I6 |
| P2-02 | ¿Ruta del tablero? | `/tablero`; `/perfil` sigue llevando ahí al vendedor |
| P2-03 | ¿Las secciones de la carta son libres o de una lista? | Libres (texto del vendedor), con sugerencias según la categoría |
| P2-04 | ¿Medio de pago por defecto? | `efectivo`, para no dejar el recuadro vacío |
| P2-05 | ¿Costo de domicilio obligatorio si hace domicilios? | No; vacío = "a convenir" |
| P2-06 | ¿El dueño puede ocultar "Tu semana"? | No en esta versión; es solo para él |
