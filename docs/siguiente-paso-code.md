# Siguiente paso para Claude Code (pendiente de enviar)

Fecha: 2026-09-28. Estado al cerrar: PR #93 (R5) y PR #94 (pulido visual) abiertos y sin fusionar; spec del Perfil 2.0 y contexto rápido en la rama `docs/perfil-2`.

Para retomar en una conversación nueva con Claude: compartir `docs/CONTEXTO-RAPIDO.md` (rama `docs/perfil-2`) y este archivo.

## Mensaje para pegar en Claude Code (pestaña de `~/ruteando`)

Escribir antes, a mano: "Esto es una instrucción nueva mía, hazla".

```
Probé el PR #94 en web: funciona. Ajustes antes de fusionarlo:
1. Los letreros de los flotantes (Favoritos, Perfil, Buscar, Ubicarme, Mapa) siempre visibles llenan la pantalla. Cámbialo a: letreros visibles solo en las primeras 3 visitas y al mantener presionado (o pasar el mouse en PC); después solo íconos, con aria-label siempre.
2. Corrige el bug que encontraste: un vendedor con más de 3 productos no puede editar ninguno ni marcarlo agotado. Con prueba.
3. Reconstruye mi base local limpia (migraciones desde cero + datos de demo) para que no choque el índice que retira R5; dime qué comando usaste.
Cuando el CI esté en verde, fusiona el #94 en develop (ya lo probé; el ajuste 1 lo reviso después en develop).

Luego empieza a implementar el Perfil 2.0 según docs/specs/perfil-2.md, en una rama que salga de la rama de R5 (feature/r5-estoy-vendiendo), para que yo pruebe R5 y el Perfil 2.0 juntos. Hazlo por etapas y detente al final de cada una con una guía corta de prueba:
- Etapa 1: "Ajustes del negocio" por familias con menús desplegables (C3), incluida la referencia junto al mapa con el aviso al mover el pin, y la paleta morada con sus tokens (Parte B). El perfil del dueño deja de ser la lista larga de hoy.
- Etapa 2: Tablero del día del vendedor (C2), con "Tu semana" (visitas, contactos, calificación y número de calificaciones) y varios negocios por horario.
- Etapa 3: Perfil del consumidor (C1) y hoja resumen del mapa (C4).
Nada se fusiona a develop sin mi prueba manual. Respuesta corta en la terminal; el detalle, en archivos.
```

## Después (orden acordado)

1. Probar R5 + Perfil 2.0 por etapas (PC y celular).
2. Tras las etapas 1 y 2: integración del botón-ancla, etapa I1 (ancla apagada por defecto, botones actuales como respaldo), empezando por el tablero del vendedor.
3. Pendientes paralelos: sesión 3 de 3 con usuarios, entrevista con la vendedora de la costa, prueba del imán fuerte (HM-16) en la demo publicada, panel de administrador (R6: hay reseñas esperando moderación desde el 14/09).
