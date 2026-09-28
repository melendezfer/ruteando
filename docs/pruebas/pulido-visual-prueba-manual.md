# Prueba manual — pulido visual (A1–A9)

Rama `fix/pulido-visual`. Incluye también `fix/credito-osm-visible` (crédito de OpenStreetMap arriba a la derecha), así que se prueban juntos. Contraseña de las cuentas de demo: `password123`.

## 0. Preparar

```bash
git switch fix/pulido-visual
docker compose up -d
```

- **PC:** `npx pm2 startOrReload ecosystem.config.cjs --only ruteando-backend,ruteando-frontend` y abrir `http://localhost:3001`.
- **Celular:** `bash scripts/dev-lan.sh --prod-frontend` y abrir la IP que imprime el script, puerto 3001.
- Nota: si tienes aplicada la migración de R5 (PR #93), la prueba automática `nearbyIndexPlan` falla en tu base local porque R5 retira un índice. No es un error de esta rama: en CI la base es nueva.

## Qué revisar (PC en vista de celular a 320 y 412 px, y en el Nubia)

| # | Dónde | Qué deberías ver |
|---|---|---|
| A1 | Perfil de un negocio, `/cuenta` → Configuración, `/buscar` | Baja hasta el final: nada queda debajo de los botones flotantes (estrellas y "Enviar mi aporte" al calificar, "Eliminar cuenta", la última fila de la carta, la última tarjeta de Buscar). Hay un espacio en blanco al final. |
| A2 | Entra como `demo-arepas-dona-rosa@ruteando.test` (abre tu negocio) | Solo el flotante **Mapa**. No aparecen WhatsApp ni Llegar. Como cliente, en el mismo negocio sí aparecen los tres. |
| A3 | Mapa y perfil | Cada flotante tiene su nombre al lado: Ubicarme, Buscar, Perfil, Favoritos (mapa); WhatsApp, Llegar, Mapa (perfil). "Volver al mapa" usa ahora el ícono de mapa, no la brújula. A 320 px el logo del mapa muestra solo el ícono (la palabra "Ruteando" chocaba con "Ubicarme"); desde 360 px se ve completo. |
| A4 | Toca un negocio en el carrusel del mapa | En el resumen, el horario ("Hoy: …") lleva un reloj, no el pin de ubicación. |
| A5 | Carrusel del mapa y lista "Ver todas" | Todas las filas dicen **Ver en el mapa** (antes "Ver ubicación", "Ver zona" o "Ver en mapa", que hacían lo mismo). "Cómo llegar" lleva la flecha de navegación, no el logo de Ruteando. |
| A6 | Quita el permiso de ubicación del navegador y abre el mapa | El mapa abre en Ciudad Verde con las calles legibles (antes: toda la región). Arriba, una sola línea: "Sin tu ubicación: te mostramos Ciudad Verde." |
| A7 | Carta de cualquier negocio | Cada fila dice "Disponible" o "Agotado" (en un servicio, "No disponible"). La hora solo aparece si cambió hoy: "Agotado desde las 11:00 a. m.". Para probarlo: entra como `demo-salchipapas-dona-nury@ruteando.test`, edita un plato, desmarca "Disponible" y vuelve a la carta. En un servicio: `demo-costuras-arreglos-maria@ruteando.test` → "No disponible". **No uses** `demo-arepas-dona-rosa`: tiene 4 productos en la carta y hoy no puede editar ninguno (409 por el límite gratis, bug anotado en CLAUDE.md §62). |
| A8 | Perfil de un negocio con varias insignias (Arepas Doña Rosa) | Las insignias (modalidad, Domicilios, Bancas, Higiene) van juntas en una o dos líneas, no una por línea. |
| A9 | Carta con algo agotado, `/cuenta` → Mis reseñas, cualquier formulario | "Agotado" se lee bien (fondo ámbar suave, texto café oscuro). Los campos de texto tienen un borde gris visible. Las estrellas de calificar se ven doradas oscuras y las vacías, grises. |
| OSM | Mapa, con y sin hojas abiertas | El crédito "Leaflet \| © OpenStreetMap" se ve completo arriba a la derecha. |

## Qué reportar

Cualquier cosa tapada, un nombre de botón confuso, un texto difícil de leer o algo que se vea distinto entre el PC y el celular.
