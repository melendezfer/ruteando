# Perfil 2.0 — Etapa 1: guía de prueba manual

Rama `feature/perfil-2-ajustes` (sale de R5, `feature/r5-estoy-vendiendo`, con `develop` al día). Prueba R5 y esta etapa juntas.

## Preparar

- **PC:** ya está corriendo. Abre `http://localhost:3001`.
- **Celular (Nubia):** en la terminal, `bash scripts/dev-lan.sh` (ya no hace falta `--prod-frontend`: con recarga en vivo también carga en el celular). Abre **`https://<IP que muestra el script>:3443`** — por https el celular sí entrega su ubicación.
  - **Solo la primera vez:** instala en el celular el certificado local que el script deja en Descargas de Windows (`ruteando-certificado-local.crt`): pásalo por WhatsApp a ti mismo, y en Ajustes > Seguridad > Encriptación y credenciales > Instalar un certificado > **Certificado de CA**. Sin él, Chrome muestra "La conexión no es privada".
- Cuenta de vendedor: `demo-arepas-dona-rosa@ruteando.test` / `password123`. Cuenta ajena para comparar: `demo-perros-el-parche@ruteando.test`.

## Qué revisar (PC y celular)

| # | Dónde | Qué debe pasar |
|---|---|---|
| 1 | Entra como Arepas Doña Rosa (abre tu negocio) | El perfil ya no es la lista larga de tarjetas: arriba "Así ven tu negocio tus clientes" con el botón **Ajustes del negocio**, luego "¿Estás vendiendo ahora?" (R5), las preguntas de clientes si hay, y la carta. |
| 2 | Toca **Ajustes del negocio** (o el engranaje) | Seis familias cerradas, cada una con una línea de resumen: Identidad, Cómo comprar, Ubicación, Horario, Confianza, Herramientas. Al final, **Mi cuenta**. |
| 3 | Identidad | Cambia nombre, categoría o descripción y toca **Guardar identidad** → "Guardado." y el resumen cambia. Debajo de la descripción dice cuántas letras ven tus clientes y cuántas te quedan (máximo 500). Foto principal con su consejo. |
| 4 | Cómo comprar | WhatsApp del negocio editable (si ya estaba verificado, avisa que tendrás que verificarlo otra vez). Domicilios y Bancas. |
| 5 | Ubicación | Modalidad, **Tu punto en el mapa** con la **Referencia** justo debajo del mapa, y privacidad. Con Ambulante aparecen también los puntos por hora y la ubicación en vivo. |
| 6 | Ubicación → mover el pin | Arrastra el pin una cuadra (o usa "Usar mi ubicación actual" lejos del puesto) y toca **Guardar ubicación**: si lo moviste más de 30 m sin tocar la referencia, pregunta "Moviste tu punto X m. ¿Cambió tu referencia?" con **Guardar** y **Sigue igual**. Si solo cambias la referencia, guarda sin preguntar. |
| 7 | Horario | Se puede editar después del registro (antes no). "Guardar horario" → "Horario guardado." El resumen dice el horario de hoy. |
| 8 | Confianza / Herramientas | Verificación de teléfono (abierta sola si falta) e higiene; código QR e ideas de tus clientes. |
| 9 | Colores (en toda la app) | Una sola familia morada: botones secundarios con borde morado; íconos de categoría morados sobre tinte suave (antes naranja/turquesa/morado por familia); en el mapa, pines morados con el ícono blanco y los grupos de pines blancos con borde y número morados. Verde, ámbar y rojo solo como estados, en versión suave ("Abierto ahora" verde suave; "Agotado" ámbar suave; eliminar en rojo suave). |
| 10 | Entra como Perros El Parche y abre `/negocios/<id de Arepas>/ajustes` | "Solo el dueño del negocio puede cambiar sus ajustes." |
| 11 | Crea una cuenta nueva como vendedor (Crear cuenta → "Tengo un negocio") | Al entrar ves **Registra tu negocio** destacado; el botón abre el asistente. Al terminar el registro, cada vez que entras aterrizas en tu negocio (aunque esté pendiente de aprobación). Con dos negocios, aterrizas en el que tiene horario ahora. |
| 12 | Botones flotantes (en cualquier pantalla) | Solo íconos, sin letreros. La primera vez aparece un aviso pequeño "Mantén presionado un botón para ver qué hace" que se cierra con un toque y no vuelve. Mantén presionado un botón: aparece su nombre y no se activa. En PC, al pasar el mouse. |

### Arreglos tras tu primera prueba (puntos 1 a 3)

| # | Dónde | Qué debe pasar |
|---|---|---|
| 13 | Celular por `https://…:3443` | La app carga (no se queda en "Cargando sesión…") y, al pedirlo, el celular da su ubicación. Las fotos se ven. |
| 14 | Cuenta nueva de vendedor → Registrar mi negocio → paso 2 (Ubicación), **sin** dar permiso de ubicación | Hay un mapa con un pin en Ciudad Verde. Arrastras el pin o tocas el mapa donde vendes. Latitud/longitud quedan plegadas en "Opciones avanzadas". Si tocas Continuar sin ubicar: "Falta ubicar tu negocio…" (ya no "fuera de Cundinamarca"). |
| 15 | Cualquier paso del registro | Arriba, **Guardar y terminar después**. Te lleva al inicio: si el negocio ya existía, tu perfil muestra "Tu registro no está completo… **Terminar registro**", que te devuelve al paso donde ibas. Si te fuiste en el paso 1, el botón de inicio dice **Continuar mi registro** y conserva lo que escribiste. |
| 16 | Pantallas angostas (360–412 px): mapa, hoja de Buscar, Buscar, Cuenta, perfil del dueño y Ajustes | Nada se sale de su caja (el botón de buscar, la X de cerrar). Con una hoja abierta sobre el mapa, abajo queda un solo botón (volver al mapa) y no tapa nada de la hoja. Horario del registro: apertura y cierre caben lado a lado. |
| 17 | Carrusel "Disponibles ahora" del mapa | Al deslizar, cada tarjeta queda alineada en el mismo lugar que la primera (antes la primera empezaba a la izquierda y las demás se centraban). |

### Etapa 1b — navegación nueva

| # | Dónde | Qué debe pasar |
|---|---|---|
| 18 | Cualquier pantalla con sesión | Arriba solo "Volver" y el título (Buscar, Mi cuenta, Mi perfil). En el costado derecho, a media altura hacia abajo, una columna de botones pequeños: Buscar, Favoritos, Perfil y, en el mapa, Ubicarme. Sin nombres a la vista; mantén presionado uno y aparece su nombre sin activarse. |
| 19 | Desplázate en Buscar, Mi cuenta y el perfil de un negocio | Ningún texto ni botón queda debajo de la columna: el contenido deja libre esa franja. |
| 20 | Mapa → Buscar (o toca una tarjeta) | Con la hoja abierta queda un solo botón (mapa) que la cierra. La hoja no pasa por debajo del botón. |
| 21 | Buscar → toca el campo de texto | Con el teclado abierto queda un solo botón. Al cerrar el teclado vuelven los demás. |
| 22a | Todas las pantallas con sesión (tu negocio, Ajustes, registro, Buscar, Cuenta, textos legales) | El último botón de la columna es siempre el mapa, en el mismo lugar. El aviso de la primera vez es pequeño, no tapa nada y se cierra tocando cualquier parte. |
| 22 | Perfil de un negocio como cliente | Arriba solo "Volver". El corazón está junto al nombre; "Cómo llegar" y "WhatsApp" son botones dentro de la página. En Mi cuenta, "Cerrar sesión" está al final. |

Al terminar, `npm run seed:demo` deja los datos de demo como estaban.

## Qué queda para las etapas siguientes

- Tablero del día (Etapa 2): pendientes, "Tu semana", varios negocios por horario. Por ahora las preguntas de clientes y "Estoy vendiendo" siguen arriba del perfil del dueño.
- Medios de pago y zona/costo de domicilio (necesitan backend nuevo): van con "Cómo comprar" del perfil del cliente (Etapa 3).

## Qué reportar

Algo que no encuentres en Ajustes, un resumen que no cambie al guardar, un color que no se lea bien o algo distinto entre PC y celular.
