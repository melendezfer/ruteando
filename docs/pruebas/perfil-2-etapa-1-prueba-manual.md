# Perfil 2.0 — Etapa 1: guía de prueba manual

Rama `feature/perfil-2-ajustes` (sale de R5, `feature/r5-estoy-vendiendo`, con `develop` al día). Prueba R5 y esta etapa juntas.

## Preparar

- **PC:** ya está corriendo. Abre `http://localhost:3001`.
- **Celular (Nubia):** en la terminal, `bash scripts/dev-lan.sh --prod-frontend` y abre `http://<IP que muestra el script>:3001`.
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

Al terminar, `npm run seed:demo` deja los datos de demo como estaban.

## Qué queda para las etapas siguientes

- Tablero del día (Etapa 2): pendientes, "Tu semana", varios negocios por horario. Por ahora las preguntas de clientes y "Estoy vendiendo" siguen arriba del perfil del dueño.
- Medios de pago y zona/costo de domicilio (necesitan backend nuevo): van con "Cómo comprar" del perfil del cliente (Etapa 3).

## Qué reportar

Algo que no encuentres en Ajustes, un resumen que no cambie al guardar, un color que no se lea bien o algo distinto entre PC y celular.
