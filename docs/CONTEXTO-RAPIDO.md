# RUTEANDO — contexto rápido

Última actualización: 2026-10-03. Este documento basta para retomar el proyecto en una conversación nueva. El detalle de cada decisión está en `CLAUDE.md` (secciones numeradas) y en `docs/`.

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
- Cada cambio de comportamiento se prueba en PC y en celular (Nubia) antes de fusionar. Para el celular: `bash scripts/dev-lan.sh` y abrir `https://<IP>:3443` (HTTPS local con mkcert; el certificado raíz se instala una vez en el celular). Ya no hace falta `--prod-frontend` (la causa del cuelgue era `allowedDevOrigins`, CLAUDE.md §63).
- Tras cambiar rutas del backend: `pm2 restart ruteando-backend` (no recarga solo).
- Levantar todo en local: `docker compose up -d`, `npm run migrate:up`, `npx pm2 startOrReload ecosystem.config.cjs`. Datos de demo: `npm run seed:demo` (contraseña `password123`).

## Estado actual (2026-10-03)

**Hecho, probado por el usuario y fusionado en `develop`:**
- R5 "Estoy vendiendo ahora" (PR #93) y pulido visual A1–A9 (PR #94).
- Perfil 2.0 Etapa 1 y 1b (PR #96): Ajustes del negocio por familias, paleta morada, ubicación con mapa y "Guardar y terminar después", HTTPS en la red local, navegación en **columna derecha** (Buscar, Favoritos, Perfil y el mapa siempre a un toque en el mismo lugar), arriba solo "Volver" + título.
- Perfil 2.0 Etapa 2 (PR #97): **tablero del día** del vendedor (`/tablero`), R3 (agotado con un toque), R4 (aviso con "Deshacer" y hoja de confirmación), R14 (escala de capas), "Ver como cliente" de solo lectura y **calificaciones públicas al instante** (una por persona; moderación solo de lo reportado).
- **Botón-ancla, etapa I1** (PR #98, probada en PC y celular): copia versionada de `boton-ancla` v0.3.1, bandera `NEXT_PUBLIC_ANCLA=1` y modos por dispositivo (Completo / Solo menú / Apagado, por defecto Apagado) en Cuenta → Configuración. Encendida, el ancla reemplaza la columna en el mismo lugar con las mismas opciones; apagada, todo igual. Detalle: `docs/integracion-ancla.md` §7.1 y CLAUDE.md §65.

**Siguiente paso exacto:**
1. **Prerrequisitos de I2** (`docs/integracion-ancla.md` §2), cada uno con la interfaz normal primero (principio 1):
   - R8: "Limpiar búsqueda" en `/buscar`.
   - R10: WhatsApp y acceso a la Carta en la hoja resumen del negocio (mapa).
   - R11: lista del grupo de pines al tocar un grupo.
   - R12: frescura en los pines ("confirmado hace X").
   - R13: zoom de un dedo en el mapa (HM-18), siempre.
   - Con R13: ocultar los `+/−` de Leaflet cuando el ancla está encendida (DI-03).
   - (Verificar R2 en el celular: crédito de OpenStreetMap arriba a la derecha.)
2. **Prueba manual del usuario** de esos prerrequisitos (PC y celular).
3. **Etapa I2:** mapa del consumidor con el ancla — capas (HM-08), desplazar y joystick (HM-09 a HM-11), apuntar y elegir pines y grupos (HM-12), imán fuerte (HM-16), soltar ejecuta y zoom de un dedo (HM-17/18). Criterio de salida: "buscar y llegar a un negocio" solo deslizando.

**Pendientes sin proveedor:** correo (recuperar contraseña), SMS (verificación de teléfono; hoy el código va al log) y push (Firebase).

## Dónde está cada cosa

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Reglas del proyecto y registro de cada épica y decisión (§0–§65) |
| `docs/CONTEXTO-RAPIDO.md` | Este resumen |
| `docs/integracion-ancla.md` | Plan del botón-ancla, prerrequisitos R1–R14, decisiones DI-01 a DI-08, etapa I1 (§7.1) |
| `docs/inventario-ancla.md`, `docs/backlog-integracion-ancla.md` | Inventario de pantallas/acciones y backlog del ancla |
| `docs/specs/r5-estoy-vendiendo.md` | Especificación de "Estoy vendiendo ahora" |
| `docs/specs/perfil-2.md` | Especificación del Perfil 2.0 y la paleta |
| `docs/pruebas/` | Guías de prueba manual por entrega |
| `openapi.yaml` | Contrato completo de la API |
| `schema.sql` + `migrations/` | Esquema inicial y migraciones versionadas |
| `scripts/` | Datos de demo, prueba de carga, acceso por LAN, crear administrador |
| Repo `boton-ancla` (aparte) | El botón-ancla (paquetes `core` y `react`, demo). RUTEANDO usa una copia de la etiqueta `v0.3.1` en `client/src/vendor/boton-ancla/` (`scripts/vendor-boton-ancla.sh`) |
