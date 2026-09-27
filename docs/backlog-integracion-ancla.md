# Backlog de integración del botón-ancla

Fecha: 2026-09-26. Sale de `docs/inventario-ancla.md`. Orden de prioridad
fijado por el usuario. Cada punto dice: qué pasa, por qué importa, qué
propongo y qué pruebas haría.

| # | Punto | Estado |
|---|---|---|
| 1 | `offerTypeId: null` en el formulario de ofertas | **Cerrado: no era un error** (fue un error del inventario) |
| 2 | Crédito de OpenStreetMap tapado | **Confirmado: tapado en parte** |
| 3 | Interruptor rápido de "agotado" en la fila | Pendiente |
| 4 | Confirmación o deshacer en acciones irreversibles | Pendiente |
| 5 | Panel de administrador con la API nueva | Pendiente |
| 6 | Botón de buscar se sale de la hoja en pantallas de 320 px | **Hipótesis sin verificar** |

---

## 1. `offerTypeId: null` en el formulario de ofertas — cerrado

**Qué pasa.** Nada malo. El inventario decía que el formulario siempre
enviaba `offerTypeId: null`. En realidad solo lo hace cuando la casilla
"Es una oferta con vigencia" está apagada, que es lo correcto para un ítem
normal del catálogo.

**Cómo se comprobó.** Con la app real y Playwright, entrando como
`demo-tintos-don-efra@ruteando.test`: Agregar plato → casilla de oferta
encendida → tipo "Promoción" → "Solo hoy". La petición salió con:

```
{"name":"Tinto doble prueba","price":2500,"available":true,
 "offerTypeId":2,"validFrom":"2026-09-26T05:00:00.000Z",
 "validUntil":"2026-09-27T04:59:59.999Z"}
```

La oferta apareció en el catálogo, sin errores en la consola. Después se
borró el producto de prueba. El backend ya tiene pruebas de integración de
ofertas (`tests/integration/products.test.js`, `discovery.test.js`).

**Por qué importa.** Si se "corrige" algo que funciona, se rompe. No se abrió
ninguna rama de arreglo.

**Mejora opcional (no es un error).** La casilla de oferta está escondida al
final del formulario y un vendedor no la ve a simple vista. Si el botón-ancla
tiene una acción "Publicar oferta", conviene que abra este mismo formulario
con la casilla ya encendida, en vez de crear un flujo nuevo.

---

## 2. Crédito de OpenStreetMap tapado — confirmado

**Qué pasa.** Capturas del Mapa en tamaño celular (iPhone SE 320×568 y
Pixel 7 412×839):

- El círculo grande de la navegación ("Mi ubicación", abajo a la derecha)
  pisa unos 10 px de la parte de arriba del texto "© OpenStreetMap".
- La píldora del logo "Ruteando" (abajo a la izquierda) tapa el ícono y
  parte de la palabra "Leaflet".

Medido: crédito en y = 534–551; círculo grande hasta y = 544; logo hasta
y = 544. El texto se sigue leyendo a medias, pero no completo.

**Por qué importa.** La licencia de los mapas de OpenStreetMap (ODbL) exige
que el crédito se vea. Además, el botón-ancla probablemente vaya a una de
esas mismas esquinas: si ya hay choque hoy, un botón más lo empeora.

**Qué propongo.**

1. Subir el crédito por encima de los elementos flotantes: moverlo a la
   esquina **superior derecha** del mapa (`attributionControl` con
   `position: "topright"`). El zoom está arriba a la izquierda y el carrusel
   queda por encima del mapa, no encima de él; el único choque sería la
   tarjeta de comparación de zonas (`top-3`, todo el ancho, solo aparece a
   veces), que habría que bajar unos píxeles.
2. Alternativa si se quiere dejar abajo: reservar una franja de ~24 px al
   fondo del mapa (`bottom-6` → `bottom-10` para el logo y la navegación).
3. Revisar lo mismo en el mapa chico del dueño (`LocationPinEditor`), que no
   tiene botones encima pero sí está dentro de una página con WhatsApp /
   Cómo llegar flotando.

**Pruebas.**

- Playwright en 3 tamaños (320, 375, 412 px de ancho): el punto central y los
  dos extremos del crédito devuelven el propio crédito con
  `document.elementFromPoint` (no otro elemento encima).
- Lo mismo con cada hoja inferior abierta (búsqueda, resumen, lista).
- Revisión a mano en el celular (pasos abajo).

### Cómo revisarlo tú en el celular

1. En el PC: `bash scripts/dev-lan.sh --prod-frontend` (el modo normal se
   queda en "Cargando sesión…" por LAN, ver CLAUDE.md sección 24).
2. En el celular, en la misma red Wi-Fi, abre `http://<IP que imprime el
   script>:3001` e inicia sesión con cualquier cuenta de demo
   (contraseña `password123`).
3. Entra al **Mapa** (el círculo con la brújula, o `/mapa`). No abras ninguna
   hoja.
4. Mira la **esquina de abajo a la derecha del mapa**, pegada al borde
   inferior: debe leerse completo "Leaflet | © OpenStreetMap".
5. Fíjate en dos cosas: si el círculo morado grande pisa las letras de
   "OpenStreetMap", y si la píldora "Ruteando" tapa la palabra "Leaflet".
6. Gira el celular a horizontal y repite. Si tienes un celular chico, ahí se
   nota más.
7. Toca "Buscar" y "Ver todas" para abrir las hojas inferiores: con una hoja
   abierta el crédito queda tapado por la hoja; eso también cuenta.

**Si está tapado** (lo esperable según las capturas): aplicar la propuesta 1
(crédito arriba a la derecha) en una rama `fix/credito-osm-visible`, con la
prueba de Playwright de arriba, y volver a revisar con estos mismos pasos.

---

## 3. Interruptor rápido de "agotado" en la fila del producto

**Qué pasa.** Para marcar un ítem como agotado hay que tocar el lápiz, buscar
la casilla "Disponible" en el modal, desmarcarla y guardar: unos 4 toques.

**Por qué importa.** Es la acción más repetida de un vendedor en la calle
(se acaba algo varias veces al día) y la mejor candidata para el botón-ancla.
El texto "Disponible hace X / No disponible hace X" ya existe; solo falta el
atajo.

**Qué propongo.**

- Un interruptor "Disponible / Agotado" en la propia fila de `ProductRow`,
  solo para el dueño, que haga `PATCH /products/{id}` con `{ available }`.
  No hace falta backend nuevo: el PATCH ya conserva los demás campos y ya
  actualiza `disponibilidad_actualizada_en` solo cuando cambia el valor.
- Actualización optimista (como el corazón de favoritos) y revertir si falla.
- Es reversible por naturaleza (el mismo interruptor), así que no necesita
  confirmación.
- El botón-ancla podría abrir una lista corta "¿Qué se acabó?" con estos
  mismos interruptores.

**Pruebas.**

- Integración (backend): un PATCH con solo `available` no cambia precio,
  nombre ni oferta (probablemente ya cubierta; confirmarlo).
- Playwright: el dueño toca el interruptor → la fila muestra "No disponible
  hace instantes" sin recargar → al recargar sigue igual → un visitante ve
  "No disponible".
- Un visitante no ve el interruptor.
- Si el PATCH falla (backend apagado), el interruptor vuelve a su valor y
  aparece un mensaje.

---

## 4. Confirmación o deshacer en las acciones irreversibles

**Qué pasa.** Estas acciones no se pueden deshacer y hoy no piden
confirmación:

| Acción | Dónde |
|---|---|
| Eliminar foto | Foto principal y foto de cada ítem |
| Subir foto nueva (borra la anterior) | Mismo control |
| Quitar un punto por hora | "Mis puntos por hora" |
| Responder Confirmar / Declinar | "Te preguntan si sigues vendiendo" |
| Publicar reseña | Perfil del negocio |

Y estas sí confirman, pero con el `window.confirm` del navegador (feo y
distinto en cada celular): eliminar ítem, salir del asistente.

**Por qué importa.** Un toque accidental en la calle, con el celular en una
mano, borra datos. Con un botón-ancla siempre a mano, el riesgo de tocar sin
querer sube.

**Qué propongo.** Dos niveles, un solo componente:

- **Deshacer (preferido)** donde el backend lo permite sin trucos: quitar un
  punto por hora (se vuelve a enviar la lista anterior con el mismo PUT),
  eliminar ítem (esperar ~5 s antes de mandar el DELETE, con aviso
  "Eliminado · Deshacer").
- **Confirmación** donde deshacer no es posible: eliminar foto, reemplazar
  foto, publicar reseña, responder Confirmar/Declinar. Una hoja inferior
  propia (`ConfirmSheet`) que reemplace también a los dos `window.confirm`.
- Un solo componente de aviso con "Deshacer" para toda la app.

**Pruebas.**

- Playwright por cada acción: cancelar no cambia nada (verificado contra la
  API, no solo la pantalla); confirmar sí.
- Deshacer: tocar "Deshacer" dentro del plazo → el dato sigue en el backend;
  dejar pasar el plazo → se borra.
- Navegar a otra pantalla con un deshacer pendiente: decidir y probar si se
  ejecuta o se cancela (propongo que se ejecute).

---

## 5. Panel de administrador con la API nueva

**Qué pasa.** El panel nuevo (`/admin/dashboard`, sección 57 de CLAUDE.md)
solo tiene login y un cascarón vacío. Toda la moderación vive en la API vieja
(`/admin/*`, que se autentica con usuarios de rol `administrador`, no con los
administradores del panel nuevo). Un administrador del panel nuevo no puede
llamar a esas rutas.

**Por qué importa.** Sin panel no hay forma práctica de aprobar negocios,
moderar reseñas ni atender solicitudes de eliminación de cuenta (Ley 1581).
Hoy se hace por SQL a mano.

**Qué propongo.** Por fases, en este orden:

1. Exponer bajo `/admin-panel/*` (con `authenticateAdmin` +
   `requireAdminRole`) la cola de negocios pendientes y aprobar/rechazar,
   reutilizando los servicios que ya usa `/admin/*`, y registrando cada
   acción con `auditoria.service.js#registrar`.
2. Módulo "Negocios pendientes" en `ADMIN_MODULES`.
3. Reseñas y fotos reportadas; reportes de información desactualizada.
4. Solicitudes de eliminación de cuenta y suspender usuario (solo
   `super_admin`).
5. Métricas y exportación; gestión de administradores.
6. Decidir si `/admin/*` se deja de usar.

**Pruebas.**

- Por cada ruta nueva: 401 sin token, 401 con token de usuario normal
  (secreto distinto), 403 con el rol equivocado, éxito con el rol correcto.
- Cada acción deja una fila en `auditoria_admin` con la acción y la entidad.
- Playwright: login de admin → módulo visible según el rol → aprobar un
  negocio → aparece en el mapa.

---

## 6. Botón de buscar se sale de la hoja en pantallas de 320 px — hipótesis sin verificar

**Qué se vio.** En una captura de Playwright a 320×568 (tamaño iPhone SE),
tomada al verificar `fix/credito-osm-visible`, el botón morado de buscar de
la hoja de búsqueda del mapa (`MapSearchSheet`, fila de `SearchBar`) queda
cortado: se sale por el borde derecho de la hoja.

**Hipótesis sin verificar.** Parece anterior a ese arreglo (el cambio solo
tocó la altura de la hoja, no su ancho), y la causa probable es que el campo
de texto de `SearchBar` no se encoge por debajo de su ancho mínimo por
defecto. Nada de esto se comprobó todavía.

**Cómo verificarlo.** Misma captura a 320 px con `develop` antes del arreglo
del crédito; si también se sale, es preexistente. Revisar además `/buscar`
a 320 px, que usa el mismo `SearchBar`.

**Qué propongo si se confirma.** `min-w-0` en el campo (y `shrink-0` en el
botón), y una prueba de Playwright a 320 px que falle si el botón queda
fuera de la hoja.
