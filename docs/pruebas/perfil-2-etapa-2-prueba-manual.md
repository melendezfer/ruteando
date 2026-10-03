# Perfil 2.0 — Etapa 2 (tablero del día) + R3, R4, R14: guía de prueba manual

Rama `feature/perfil-2-tablero`.

## Preparar

- **PC:** ya está corriendo. Abre `http://localhost:3001`.
- **Celular:** `https://192.168.1.7:3443` (si se reinició el computador: `bash scripts/dev-lan.sh`).
- Vendedor con un negocio: `demo-arepas-dona-rosa@ruteando.test` / `password123`.
- Para ver varios negocios: con tu cuenta de vendedor registra un segundo negocio con otro horario (o pídemelo y lo siembro).

## Qué revisar

| # | Dónde | Qué debe pasar |
|---|---|---|
| 1 | Entra como Arepas Doña Rosa | Llegas a **Mi negocio hoy** (no a tu perfil). Arriba la fecha y la hora; la tarjeta del negocio dice "Abierto hasta…" o "Abre hoy a las…", con **Estoy vendiendo ahora**, **Ver como cliente** y **Ajustes**. |
| 2 | Con dos negocios | "Mis negocios de hoy": en **Ahora** el que tiene horario en este momento; en **Después** los demás con su hora ("Cerrado hoy" atenuado). Tocar uno de Después lo sube a la tarjeta principal. |
| 3 | Tu semana | Visitas al perfil, Contactos (WhatsApp y Cómo llegar), Calificación y Reseñas por revisar, con la diferencia contra la semana pasada. Abre tu perfil desde otra cuenta y toca "Cómo llegar": al recargar el tablero, Contactos sube. |
| 4 | Pendientes | Preguntas de clientes sin responder; si falta ubicación u horario, "Tu registro no está completo · Terminar registro"; si el WhatsApp no está verificado, el aviso para verificarlo; una oferta que vence hoy. |
| 5 | ¿Qué se acabó? | Un toque cambia un producto entre **Disponible** y **Agotado**. Abajo aparece un aviso pequeño "…: agotado · Deshacer" que no tapa la columna derecha; "Deshacer" lo devuelve. El cambio se ve en tu perfil como cliente. |
| 6 | Atajos → Publicar oferta | Abre tu perfil con el formulario de producto y "Es una oferta con vigencia" ya encendida. "Agregar producto" (bajo la lista) lo abre sin oferta. |
| 7 | Tu perfil → despliega un producto → borrar | Sale una hoja de la app "¿Eliminar…? Esta acción no se puede deshacer" con Cancelar / Eliminar (ya no el diálogo gris del navegador). |
| 8 | Registro de negocio sin terminar → la X de arriba | Hoja "Tu registro no está completo" con Seguir aquí / Salir, por encima del mapa. |
| 9 | Columna derecha en el tablero | Igual que en el resto: Buscar, Favoritos, Perfil y Mapa abajo. Perfil vuelve al tablero. |

### Ajustes tras tu prueba

| # | Dónde | Qué debe pasar |
|---|---|---|
| 10 | Tablero | Orden: tu negocio de ahora, ¿Qué se acabó?, Pendientes, Tu semana, Después y atajos (Publicar oferta, Agregar producto). |
| 11 | Tablero → Ver como cliente | Franja "Vista de cliente · Volver a mi tablero". Al abrir un plato no aparece cambiar ni eliminar foto, ni editar, ni ningún otro control tuyo. |
| 12 | Como consumidor, califica un negocio | Al enviar, el perfil muestra "★ 5,0 · 1 calificación" sin recargar. En el mapa, la tarjeta del carrusel y la hoja del negocio muestran lo mismo. |
| 13 | Califica el mismo negocio otra vez | "Actualizamos tu calificación": el número de calificaciones no sube y el promedio usa la nueva. |
| 14 | Como dueño, en tu negocio | No hay formulario para calificarte. Comentarios y etiquetas siguen viéndose solo en "Ideas de tus clientes" (Ajustes → Herramientas). |

## Qué reportar

Una cifra que no cambie, un orden de negocios que no corresponda a la hora, algo que quede tapado o un aviso que no se pueda deshacer.

## Siguiente paso

Etapa I1 de `docs/integracion-ancla.md` (infraestructura del botón-ancla, que ocupará el lugar de la columna derecha).
