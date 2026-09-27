# Inventario de RUTEANDO para integrar el "botón-ancla"

Fecha: 2026-09-26. Base: rama `feature/iconos-pantallas` (PR 3 de íconos,
todavía sin fusionar a `develop`). Solo lectura: este documento describe lo
que hay hoy en `client/src` y `src/routes`, sin cambiar código.

Convenciones de este documento:

- **Irreversible**: no hay forma de deshacerlo desde la app.
- **Se puede deshacer**: la misma pantalla ofrece la acción contraria.
- **Semi**: se puede "arreglar" después, pero no es un deshacer directo (queda
  rastro, o hay que repetir pasos).

---

## 1. Pantallas y rutas, por rol

| Ruta | Quién la ve | Propósito |
|---|---|---|
| `/` | Todos con sesión | Router por rol: consumidor/admin viejo/vendedor sin negocio activo → **Mapa**. Vendedor con 1 negocio activo → su perfil de negocio. Vendedor con 2+ → selector de negocio. |
| `/mapa` | Todos con sesión | Siempre el mapa (sin redirección por rol). Acepta `?businessId=`, `?categoryId=`, `?favoritesOnly=true`, `?offerTypeId=`. |
| `/buscar` | Todos con sesión | Búsqueda por texto y categorías, lista "Cerca de ti", modo Sencilla/Avanzada, filtros de precio y "Abierto ahora". |
| `/favoritos` | — | Ya no es pantalla: redirige a `/mapa?favoritesOnly=true`. |
| `/perfil` | Todos con sesión | Router por rol: consumidor → cuenta (Reseñas + Configuración). Vendedor con negocio activo → su negocio (1) o el selector (2+). |
| `/cuenta` | Todos con sesión | La cuenta sin redirección (la usa el vendedor desde el engranaje de su negocio). |
| `/negocios/[id]` | **Visitante**, consumidor, vendedor | Perfil público del negocio (se renderiza en servidor, vista previa de WhatsApp). Si quien mira es el dueño, se convierte en su panel de gestión. |
| `/negocios/nuevo` | Vendedor (asistente de 3 pasos); administrador viejo (registro asistido); consumidor (aviso "necesitas cuenta de vendedor") | Registrar un negocio. |
| `/login`, `/register` | Visitante | Entrar / crear cuenta (con consentimientos). |
| `/recuperar-contrasena`, `/restablecer-contrasena` | Visitante | Pedir y usar el enlace de recuperación (el correo real no existe: el token va al log). |
| `/legal/terminos-condiciones`, `/legal/tratamiento-datos` | Visitante | Textos legales. |
| `/admin` → `/admin/dashboard` | Administrador (sistema nuevo) | Panel: por ahora solo cascarón vacío. |
| `/admin/login` | Administrador (sistema nuevo) | Entrar al panel (sesión separada de la de usuario). |

**Resumen por rol**

| Rol | Pantallas que usa |
|---|---|
| Visitante (sin sesión) | `/login`, `/register`, recuperar/restablecer, `/legal/*`, `/negocios/[id]` (por link compartido). Las demás muestran "inicia sesión". |
| Consumidor | Mapa, Buscar, Perfil/Cuenta, perfil de negocio, `/negocios/nuevo` (solo aviso). |
| Vendedor | Lo mismo que el consumidor + su negocio en modo dueño + asistente de registro + selector de negocio. |
| Administrador (sistema nuevo, `/admin-panel/*`) | Solo `/admin/login` y `/admin/dashboard`. |
| Administrador (sistema viejo, `rol_usuario = administrador`) | Usa la app normal; su única pantalla propia es el registro asistido en `/negocios/nuevo`. |

---

## 2. Acciones por pantalla

### 2.1 Mapa (`/` y `/mapa`)

| Elemento | Tipo | Acción | ¿Reversible? |
|---|---|---|---|
| Carrusel "Disponibles ahora" (arriba) | Tarjetas | Tocar tarjeta → resumen del negocio | Sí (cerrar) |
| Ícono de categoría en la tarjeta | Botón | Abre la lista filtrada por esa categoría | Sí (cerrar) |
| "Ver en el mapa" / "Ver ubicación" / "Ver zona" | Botón | Centra el mapa en el negocio | Sí |
| "Cómo llegar" | Enlace externo | Abre Google Maps en otra pestaña | Sale de la app |
| "Ver todas" (última tarjeta) | Botón | Abre la lista filtrada en "Disponibles ahora" | Sí (cerrar) |
| Pin | Seleccionable | Abre el resumen (`BusinessSummarySheet`) | Sí (cerrar) |
| Grupo de pines (cluster) | Seleccionable | Acerca el zoom | Sí |
| Círculo de zona | Solo tooltip | Muestra "N negocios · M tipos" | — |
| Tarjeta de comparación de zonas (arriba) | Botón "Ver esa zona" | Centra el mapa en otra zona | Sí |
| **Nav flotante** (abajo derecha) | 4 círculos | 1) "Mi ubicación" o "Volver al mapa"; 2) Buscar (abre hoja); 3) Perfil; 4) Favoritos | Sí (navegación) |
| Hoja de búsqueda (`MapSearchSheet`) | Hoja inferior | Texto, Sencilla/Avanzada, distancia, precio, abierto ahora, resultados; "Limpiar búsqueda"; X | Sí |
| Resumen del negocio (`BusinessSummarySheet`) | Hoja inferior | Tarjeta con corazón, "Ver perfil completo", "Cómo llegar"; X | Sí |
| Lista filtrada (`FilteredListSheet`) | Hoja inferior (70 % alto) | Pestañas: Disponibles ahora / Cerca de ti ahora / Favoritos / categoría u oferta. Tocar fila → **navega al perfil del negocio**; X | Sí |
| Corazón (en tarjetas) | Botón | Marcar / desmarcar favorito | **Sí** (mismo botón) |

### 2.2 Buscar (`/buscar`)

| Elemento | Tipo | Acción | ¿Reversible? |
|---|---|---|---|
| Barra de búsqueda | Campo | Buscar por texto (registra evento `busqueda`) | Sí (no hay botón "limpiar") |
| Sencilla / Avanzada | Segmentado | Muestra u oculta precios; volver a Sencilla borra el precio | Sí |
| Precio mín./máx., Abierto ahora | Campos | Filtran la lista | Sí |
| Chips de categoría | Botones | Filtran por categoría | Sí |
| Tarjeta de negocio | Se expande en el sitio | Horario, "Ver perfil completo", "Ver en el mapa", "Cómo llegar", corazón | Sí |
| Nav flotante | 4 círculos | "Volver al mapa", Buscar, Perfil, Favoritos | Sí |

### 2.3 Perfil de negocio — visitante / consumidor (`/negocios/[id]`)

| Elemento | Tipo | Acción | ¿Reversible? |
|---|---|---|---|
| "Volver" (arriba izq.) | Botón | Atrás en el historial, o `/` si llegó por link | Sí |
| Corazón (arriba der.) | Botón | Favorito (solo con sesión y si no es el dueño) | **Sí** |
| Insignia "Higiene autodeclarada" | Botón | Abre modal con la aclaración legal | Sí |
| "Preguntar si está vendiendo" | Botón | Crea una solicitud de disponibilidad (espera respuesta 10 min) | **No** (no se puede cancelar) |
| Fila del catálogo (Carta/Productos/Servicios) | Se expande en el sitio | Foto grande, descripción (evento `vista_producto`) | Sí |
| Insignia de oferta en un producto | Botón | Va a `/mapa?offerTypeId=` | Sí |
| Formulario de reseña | Estrellas + etiquetas + comentario privado | Publicar reseña | **No** desde aquí (se borra solo desde el backend; no hay botón en la app) |
| Anónimo | Enlace | "Inicia sesión para calificar" | — |
| Botones flotantes (abajo der.) | 3 círculos | WhatsApp (grande, evento `clic_contacto`), Cómo llegar, Volver al mapa | Salen de la app / navegación |

### 2.4 Perfil de negocio — dueño (vendedor)

Todo lo anterior (menos corazón, pregunta y reseña), más:

| Elemento | Tipo | Acción | ¿Reversible? |
|---|---|---|---|
| Engranaje (arriba der.) | Enlace | Va a `/cuenta` | Sí |
| Banner de estado | Aviso | Pendiente / rechazado / suspendido | — |
| "Te preguntan si sigues vendiendo" | Panel (se refresca cada 8 s) | Confirmar / Declinar cada pregunta | **No** (la respuesta queda guardada) |
| Verificación de teléfono | Panel | Enviar código SMS, confirmar código | Enviar: no (cuenta contra el límite de 3/10 min). Confirmar: no |
| Zona aproximada / dirección exacta | Interruptor | Cambia qué coordenada ve el público | **Sí** |
| Ajustar ubicación en el mapa | Mapa con pin arrastrable | Arrastrar o "Usar mi ubicación actual" → Guardar / Cancelar | Cancelar sí; **Guardar: semi** (crea fila nueva en el historial, se puede volver a mover) |
| Hago domicilios / Tengo bancas / Higiene | Interruptores | Cambian insignias públicas | **Sí** |
| Modalidad (ambulante / puesto en la calle / local) | Segmentado de 3 | Cambia la marca del pin | **Sí** |
| Ubicación en vivo (solo ambulante) | Interruptor + modal de consentimiento | Encender comparte posición cada 15 s; apagar borra el recorrido | Encender/apagar: sí. **El consentimiento: no** (no hay forma de retirarlo) |
| Mis puntos por hora (solo ambulante) | Lista + formulario | Agregar franja, quitar franja | Sí (quitar no pide confirmación) |
| Código QR | Botones | Descargar PNG, Copiar enlace | Inofensivo |
| Foto principal | Control de foto | Elegir → vista previa → Subir / Cancelar; Eliminar foto | Subir: **reemplaza y borra la anterior (no)**. Eliminar: **no** (sin confirmación) |
| "Agregar plato/producto/servicio" | Modal (2 pasos: datos → foto) | Crea el ítem; luego "Listo" / "Continuar sin foto" | Crear: semi (se puede eliminar después) |
| Editar ítem (lápiz) | Modal | Nombre, precio, descripción, **disponible**, oferta con vigencia | Sí |
| Eliminar ítem (papelera) | `window.confirm` del navegador | Borra ítem y sus fotos | **No** |
| Foto de un ítem | Control de foto (en la fila expandida) | Igual que la foto principal | Igual que arriba |
| "Ideas de tus clientes para mejorar" | Panel de solo lectura | Ver retroalimentación anónima | — |

### 2.5 Asistente de registro (`/negocios/nuevo`)

| Paso | Acciones | ¿Reversible? |
|---|---|---|
| Datos (nombre, categoría, descripción, teléfono, domicilios, bancas) | Siguiente | Semi (crea el negocio en el backend) |
| Ubicación | Usar mi ubicación / escribir coordenadas; tipo; referencia; zona aproximada | Semi (editable luego en el perfil) |
| Horario | Días y horas | Sí (se reemplaza completo) |
| Listo | Verificar teléfono (mismo panel), ir al perfil | — |
| ✕ (salir) | `window.confirm` "¿seguro que quieres salir?" | Lo ya enviado queda creado |
| Registro asistido (admin viejo) | Formulario único | **No** (crea cuenta + negocio) |

### 2.6 Perfil / Cuenta (`/perfil`, `/cuenta`)

| Elemento | Tipo | Acción | ¿Reversible? |
|---|---|---|---|
| "Cerrar sesión" | Botón | Cierra sesión | Sí (volver a entrar) |
| Pestaña Reseñas | Lista | Ver mis reseñas (solo lectura, sin borrar) | — |
| Tu cuenta | Formulario | Editar nombre y celular | Sí |
| Contraseña | Formulario | Cambiar contraseña (cierra las demás sesiones) | Semi (se cambia otra vez, pero las otras sesiones ya se cerraron) |
| Preguntas de disponibilidad | Botón | "Activar notificaciones" (consentimiento) | **No** (no hay retirar) |
| Consentimientos otorgados | Lista | Solo lectura | — |
| Eliminar cuenta | Modal con encuesta opcional | Envía solicitud (la procesa un admin) | **No** (no hay "cancelar solicitud") |
| Nav flotante | 4 círculos | "Volver al mapa", Buscar, Perfil, Favoritos | Sí |

### 2.7 Selector de negocio (vendedor con 2+)

| Elemento | Acción | ¿Reversible? |
|---|---|---|
| Lista de nombres | Ir a ese negocio | Sí |
| Nav flotante | Igual que arriba | Sí |

### 2.8 Entrada (`/login`, `/register`, recuperar)

| Elemento | Acción | ¿Reversible? |
|---|---|---|
| Entrar / Crear cuenta | Autenticación | Crear cuenta: **no** |
| Modal de consentimiento obligatorio (si faltan) | Aceptar ambos checks | **No** |
| "¿Olvidaste tu contraseña?" | Pide enlace | Inofensivo |

### 2.9 Panel de administrador (`/admin/dashboard`)

| Elemento | Acción | ¿Reversible? |
|---|---|---|
| Cerrar sesión | Cierra la sesión de admin | Sí |
| Menú lateral | Vacío: "Todavía no hay módulos habilitados." | — |

---

## 3. Qué se desplaza y qué se puede seleccionar

| Pantalla | Se desplaza | Se puede seleccionar |
|---|---|---|
| Mapa | Carrusel "Disponibles ahora" (horizontal, con imán); el mapa (arrastrar/zoom); resultados dentro de la hoja de búsqueda; lista y pestañas de la lista filtrada (vertical / horizontal) | Pines, grupos de pines, tarjetas del carrusel, filas de resultados, filas de la lista filtrada, pestañas |
| Buscar | Página completa (vertical); chips de categoría (horizontal) | Tarjetas (se expanden), chips |
| Perfil de negocio | Página completa (vertical) | Filas del catálogo (se expanden); pin arrastrable (dueño); mapa chico sin zoom con rueda |
| Cuenta | Página completa | Pestañas Reseñas / Configuración |
| Asistente | Cada paso | Días de la semana, categoría |
| Admin | Nada relevante | — |

---

## 4. Esquinas y zonas ocupadas

| Pantalla | Arriba izq. | Arriba der. | Abajo izq. | Abajo der. | Centro / franjas |
|---|---|---|---|---|---|
| Mapa | — (carrusel ocupa toda la franja superior) | Tarjeta de zonas cruza todo el ancho (`top-3`, `left-3 right-3`) | **Logo "Ruteando"** (`bottom-6 left-6`) | **Nav flotante** 4 círculos (`bottom-6 right-6`, alto ~ 16+12·3 + huecos ≈ 230 px) | Hojas inferiores ocupan todo el ancho, hasta 70-75 % del alto, con X en su esquina sup. der. **Crédito de OpenStreetMap** abajo der. dentro del mapa (pegado bajo la nav). Botones +/− de zoom de Leaflet arriba izq. del mapa |
| Buscar | — | — | — | Nav flotante | Contenido con `pb-24` |
| Perfil de negocio | **"Volver"** (`left-3 top-3`) | **Corazón** (visitante) o **engranaje** (dueño) (`right-3 top-3`) | Píldora "Abierto/Cerrado ahora" sobre la foto (no fija, se va con el scroll) | **WhatsApp + Cómo llegar + Volver al mapa** (`bottom-6 right-6`) | Mapa chico del dueño con crédito OSM y +/− |
| Cuenta / Perfil / Selector | — | — | — | Nav flotante | — |
| Modales | Todos `fixed inset-0`, suben desde abajo en celular, centrados en pantallas grandes | | | | z-index 50 (1100 el de ubicación en vivo) |
| Admin | Logo + "Ruteando" en el header | Nombre, rol y "Cerrar sesión" | — | — | Menú lateral izq. |

Notas:

- El indicador de desarrollo de Next.js está apagado (`devIndicators: false`)
  porque chocaba con las cuatro esquinas.
- La **única esquina libre** de forma constante es **abajo izquierda fuera del
  mapa** (Buscar, Cuenta, Perfil, Selector) — en el Mapa la ocupa el logo y en
  el perfil de negocio queda libre solo después de hacer scroll.

---

## 5. Estado del panel de administrador y del perfil del vendedor

### 5.1 Panel de administrador

| Pieza | Existe hoy | Falta según los documentos / CLAUDE.md |
|---|---|---|
| Login y sesión separados (`/admin-panel/*`, dos roles: admin y admin maestro) | Sí (backend + UI) | — |
| Tabla de auditoría | Sí, sin ninguna acción real que la use | Registrar cada acción de moderación |
| Crear/desactivar administradores | Solo script (`npm run admin:crear-maestro`) | Pantalla de gestión |
| Aprobar / rechazar negocios pendientes (RF-019) | API vieja `/admin/*` | Pantalla |
| Moderar reseñas reportadas (RF-016/020) | API vieja | Pantalla |
| Fotos reportadas | API vieja (`/admin/photos/reported`) | Pantalla |
| Suspender usuario | API vieja | Pantalla |
| Reportes de "información desactualizada" (RF-025) | API vieja | Pantalla |
| Solicitudes de eliminación de cuenta (Ley 1581) | API vieja | Pantalla + el borrado real de datos (no existe en ningún lado) |
| Tipos de oferta | API vieja | Pantalla |
| Métricas y exportación (RF-021/022) | API vieja | Pantalla |
| Registro asistido | Formulario dentro de la app normal (admin viejo) | Moverlo al panel nuevo |
| Decidir qué pasa con el sistema viejo | — | Migrar o deprecar `/admin/*` |

### 5.2 Perfil del vendedor

| Pieza | Existe hoy | Falta |
|---|---|---|
| Ver y gestionar su negocio en el perfil público (modo dueño) | Sí | No hay pantalla "editar negocio" aparte: nombre, descripción, categoría y teléfono solo se ponen en el asistente |
| Horario | Solo en el asistente | Editarlo después del registro |
| Estado de aprobación | Banner | — |
| Verificación de teléfono | Sí (SMS simulado en el log) | Proveedor real de SMS |
| Catálogo (crear, editar, eliminar, fotos) | Sí | Reordenar; campo de categoría del producto |
| Ofertas con vigencia | Sí: casilla "Es una oferta con vigencia" en el formulario del ítem (tipo, Solo hoy / Este mes / Personalizado). Límite 1 gratis | — (ver la corrección al final) |
| Retroalimentación privada | Sí | — |
| Varios negocios | Selector | Selector sin foto ni categoría |
| Notificaciones push | Backend listo | Firebase sin credenciales, sin registro del token en el navegador |
| Passkeys | No | Rutas WebAuthn no existen |

---

## 6. Acciones de vendedor que existen hoy

| Acción | Dónde | Cómo | Nota |
|---|---|---|---|
| Confirmar / declinar disponibilidad | Panel "Te preguntan si sigues vendiendo" en su negocio | Botones por pregunta | Solo si tiene la pantalla abierta (sin push). Requiere haber activado notificaciones en Configuración |
| Marcar agotado / disponible | Editar ítem (lápiz) → casilla "Disponible" → Guardar | 3 toques + modal | **No hay un interruptor rápido en la fila**. Muestra "Disponible/No disponible hace X" |
| Ubicación en vivo | Interruptor en su negocio (solo ambulante) | Consentimiento la 1.ª vez; comparte cada 15 s con la app abierta | Se apaga sola fuera de horario/franja o si la app se cierra 2 min |
| Puntos por hora | "Mis puntos por hora" (solo ambulante) | Agregar/quitar franjas | Máx. 35 |
| Ajustar ubicación base | Mapa con pin arrastrable | Arrastrar / "Usar mi ubicación" → Guardar | — |
| Ofertas | Formulario del ítem (Agregar o lápiz) | Casilla "Es una oferta con vigencia" → tipo + vigencia | Máx. 1 oferta vigente en plan gratis |
| Domicilios, bancas, higiene, modalidad, zona aproximada | Interruptores en su negocio | Un toque | Reversibles |
| Fotos | Control de foto | Subir reemplaza; eliminar sin confirmar | — |
| QR | Tarjeta QR | Descargar / copiar | — |
| Registrar negocio | `/negocios/nuevo` | Asistente de 3 pasos | — |

---

## 7. Huecos que veo

1. **No hay "marcar agotado" rápido**: la acción más frecuente de un vendedor
   exige abrir el modal de edición. Candidata natural para el botón-ancla.
2. ~~No se pueden crear ofertas desde la app~~ — **error de este inventario**,
   ver la corrección al final.
3. **Acciones irreversibles sin confirmación**: eliminar foto, subir una foto
   que reemplaza (borra la anterior), quitar una franja, responder una
   pregunta de disponibilidad, publicar una reseña.
4. **Confirmaciones inconsistentes**: dos usan `window.confirm` del navegador
   (eliminar ítem, salir del asistente); el resto usa modales propios o nada.
5. **Sin deshacer en ningún lado** (no hay "toast" con "Deshacer").
6. **Sin UI para reportar** reseñas, fotos o negocio desactualizado, aunque
   el backend tiene las tres rutas.
7. **No se puede borrar una reseña propia** desde "Mis reseñas" (el backend sí
   permite `DELETE /reviews/{id}`).
8. **No se puede retirar un consentimiento** (notificaciones, ubicación en
   vivo) ni cancelar una solicitud de eliminación de cuenta.
9. **No se puede cancelar una pregunta de disponibilidad** ya enviada.
10. **Panel de administrador vacío**: todas las funciones de moderación viven
    solo en la API vieja.
11. **Sin pantalla para editar negocio/horario** después del registro.
12. **Esquinas saturadas**: en el Mapa y en el perfil de negocio las cuatro
    esquinas ya están ocupadas (logo, nav de 4 círculos, "Volver",
    corazón/engranaje, crédito OSM, zoom de Leaflet). **Comprobado después
    con capturas (iPhone SE y Pixel 7)**: el círculo grande de la nav tapa la
    parte de arriba del texto "OpenStreetMap" y el logo "Ruteando" tapa el
    ícono de "Leaflet". Ver `docs/backlog-integracion-ancla.md`, punto 2.
13. **El vendedor solo recibe preguntas con la pantalla abierta** (sin push).
14. **Nav flotante sin estado activo**: no marca en qué pantalla estás.
15. **`/buscar` sin botón para limpiar la búsqueda.**
16. **Registro asistido** vive en la app normal con el rol de admin viejo, no
    en el panel nuevo.

---

## Corrección (2026-09-26)

La primera versión de este inventario decía que el formulario de producto
"siempre manda `offerTypeId: null`" y que las ofertas no se podían crear desde
la app. **Era falso**: leí solo la rama del formulario para ítems normales.
Con la casilla "Es una oferta con vigencia" encendida, el formulario envía el
tipo y la vigencia. Lo comprobé en la app real con Playwright: la petición
salió con `"offerTypeId":2` (Promoción) y la oferta apareció en el catálogo.
