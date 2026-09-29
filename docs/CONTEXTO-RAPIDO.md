# RUTEANDO — contexto rápido

Última actualización: 2026-09-28. Este documento basta para retomar el proyecto en una conversación nueva. El detalle de cada decisión está en `CLAUDE.md` (secciones numeradas) y en `docs/`.

## Qué es y para qué

RUTEANDO es un mapa de comercio informal de Ciudad Verde (Soacha, Colombia): comida callejera, tintos, costureras, artesanos, asesorías. Un vendedor se registra sin registro mercantil ni facturación; un cliente lo encuentra en el mapa, ve si está vendiendo ahora y le escribe por WhatsApp o llega con Google Maps. **No hay pagos ni pedidos dentro de la app**: RUTEANDO es intermediario de información.

**Objetivo de todo el producto: práctico, ágil, limpio y organizado.**

## A quién sirve

- **Vendedor informal** (persona "Don Alirio"): poca familiaridad digital, usa el celular con una mano, necesita avisar que salió a vender y que lo encuentren.
- **Cliente del barrio**: quiere saber qué hay cerca, abierto de verdad, y cómo llegar o escribir.
- **Equipo administrador**: aprueba negocios y modera (panel en construcción).

## Principios de diseño

1. **Práctico, ágil, limpio.** Pocas pantallas, pocas palabras, una acción principal por pantalla.
2. **Divulgación progresiva.** Primero lo necesario; el resto a la mano, desplegándose en el mismo lugar (acordeón, hoja inferior), no en pantallas nuevas.
3. **Un ícono, un significado.** Registro único en `client/src/lib/icons/semantic-icons.ts`; la categoría se reconoce por su ícono.
4. **Frescura visible.** Todo dato que depende del vendedor dice cuándo se confirmó ("confirmado hace X"). Nada vence con cron: se calcula al leer.
5. **El botón-ancla es un atajo, nunca la única puerta.** Toda función existe primero con la interfaz normal.
6. **Hallazgos sin verificar se marcan como hipótesis** hasta probarlos con la app corriendo o con una prueba.

## Stack (una línea)

Node.js 24 + Express 5 + PostgreSQL 18/PostGIS 3.6 (REST, contrato en `openapi.yaml`) · Next.js (App Router) PWA + Tailwind + Leaflet + Phosphor · MinIO/S3 para fotos · pm2 y Docker Compose en desarrollo · GitHub Actions (CI).

## Cómo se trabaja

- Ramas `feature/`, `fix/`, `docs/`, `chore/` **desde `develop`**. `main` va muy atrás.
- **Autonomía** (CLAUDE.md §1): Claude decide lo técnico y registra cada decisión; se detiene solo para la prueba manual del usuario, para fusionar algo que cambie el comportamiento de la app, ante riesgos legales/seguridad/datos personales, o para borrar historial. PR de solo documentos o CI se fusionan sin preguntar, siempre con CI en verde. **Nunca con CI en rojo.**
- Cada cambio de comportamiento se prueba en PC y en celular (Nubia) antes de fusionar. Para el celular: `bash scripts/dev-lan.sh --prod-frontend` (con `next dev` la app se cuelga por la red local).
- Levantar todo en local: `docker compose up -d`, `npm run migrate:up`, `npx pm2 startOrReload ecosystem.config.cjs`. Datos de demo: `npm run seed:demo` (contraseña `password123`).

## Estado actual (2026-09-28)

**Hecho (en `develop`):** registro y login con consentimientos (Ley 1581), negocios con ubicación/horario/fotos/carta, mapa y búsqueda unificada con filtros, zonas de aglomeración, favoritos, reseñas con retroalimentación privada, verificación de teléfono (sin proveedor de SMS: el código va al log), "vendiendo ahora" por preguntas del cliente, modalidades (ambulante / en la calle / local) con franjas por hora y ubicación en vivo, íconos y colores por categoría, panel de administrador fase 1 (solo login), plan de integración del botón-ancla v0.3, CI con MinIO fijo en `bitnamilegacy`.

**En PR, esperando prueba manual del usuario:**
- PR #93 — R5 "Estoy vendiendo ahora" (aviso propio del vendedor). Guía: `docs/pruebas/r5-prueba-manual.md`.
- PR #94 `fix/pulido-visual` — arreglos visuales A1–A9 (A9: contraste de "No disponible" y bordes de campos). Guía: `docs/pruebas/pulido-visual-prueba-manual.md`.
- `fix/credito-osm-visible` — crédito de OpenStreetMap visible (incluido también en `fix/pulido-visual`).

**Sigue:**
1. Perfil 2.0 (spec `docs/specs/perfil-2.md`): perfil del negocio con divulgación progresiva, tablero del día del vendedor, ajustes del negocio y paleta morada. Se implementa después de probar R5.
2. Prerrequisitos del ancla R3, R4, R6–R14 (`docs/integracion-ancla.md` §2).
3. Integración del botón-ancla (etapas I1–I6).
4. Pendientes sin proveedor: correo, SMS y push (Firebase).

**Actualización 2026-09-29:** PR #94 fusionado en `develop` (incluye el arreglo del límite gratis al editar productos, letreros de flotantes solo en las 3 primeras visitas y reintentos de MinIO en CI). Base local reconstruida desde cero; respaldo previo en `~/respaldos-ruteando/`. Perfil 2.0 en curso en `feature/perfil-2-ajustes` (sale de R5).

## Dónde está cada cosa

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Reglas del proyecto y registro de cada épica y decisión (§0–§61) |
| `docs/CONTEXTO-RAPIDO.md` | Este resumen |
| `docs/integracion-ancla.md` | Plan del botón-ancla, prerrequisitos R1–R14, decisiones DI-01 a DI-07 |
| `docs/inventario-ancla.md`, `docs/backlog-integracion-ancla.md` | Inventario de pantallas/acciones y backlog del ancla |
| `docs/specs/r5-estoy-vendiendo.md` | Especificación de "Estoy vendiendo ahora" |
| `docs/specs/perfil-2.md` | Especificación del Perfil 2.0 y la paleta |
| `docs/pruebas/` | Guías de prueba manual por entrega |
| `openapi.yaml` | Contrato completo de la API |
| `schema.sql` + `migrations/` | Esquema inicial y migraciones versionadas |
| `scripts/` | Datos de demo, prueba de carga, acceso por LAN, crear administrador |
| Repo `boton-ancla` (aparte) | El botón-ancla (paquetes `core` y `react`, demo); etiqueta `v0.3.0` |
