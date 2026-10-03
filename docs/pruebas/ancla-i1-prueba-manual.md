# Botón-ancla — etapa I1 (infraestructura): guía de prueba manual

Rama `feature/ancla-i1`. Lo que se prueba: que el ancla se pueda encender y apagar, que encendida ocupe el lugar de la columna de botones con las mismas opciones, y que **apagada todo quede igual que antes**.

## Preparar

- **PC:** `http://localhost:3001`. **Celular:** `https://192.168.1.7:3443`.
- La bandera ya está activa en tu entorno (`NEXT_PUBLIC_ANCLA=1` en `client/.env.local`).
- Cualquier cuenta (consumidor o vendedor).

## Qué revisar

| # | Dónde | Qué debe pasar |
|---|---|---|
| 1 | Sin cambiar nada | Todo igual que antes: la columna de botones a la derecha, sin ancla. |
| 2 | Perfil → Mi cuenta → Configuración → "Botón para una mano" | Tres opciones: Completo, Solo menú y Apagado (marcado). Al elegir otra, la pantalla no se reinicia (sigues en Configuración). |
| 3 | Elige **Completo** y ve al mapa | La columna desaparece; en su lugar, un solo botón redondo. La primera vez pregunta con qué mano lo usas. |
| 4 | Mapa: mantén presionado el botón y desliza hacia una opción, suelta | Opciones: Mi ubicación (arriba), Buscar, Favoritos y Perfil. Soltar sobre una la ejecuta. También funciona tocando el botón y luego la opción. |
| 5 | Buscar, tu cuenta, el perfil de un negocio, Ajustes | El centro dice la sección; arriba "Atrás"; las opciones son Buscar, Favoritos, Perfil y Mapa. Con una hoja abierta en el mapa, "Atrás" la cierra. |
| 6 | En cualquier pantalla | El botón no tapa texto ni controles (el contenido deja libre esa franja derecha) ni el crédito de OpenStreetMap. La mano que elegiste se recuerda en este celular. |
| 7 | **Solo menú** | Igual que Completo, pero sin mover el mapa con el botón. |
| 8 | Vuelve a **Apagado** | Regresa la columna de siempre. |

## Qué reportar

Algo que cambió con el ancla apagada, una opción que no responda al soltar, el botón tapando algo, o diferencias entre PC y celular.

## Siguiente paso

Antes de I2 (mapa con capas, joystick y apuntar y elegir): R8, R10–R13 de `docs/integracion-ancla.md` y verificar R2 en el celular.
