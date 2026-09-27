# Prueba manual — R5 "Estoy vendiendo ahora"

Rama `feature/r5-estoy-vendiendo`. Especificación: `docs/specs/r5-estoy-vendiendo.md`.
Todas las cuentas de demo usan la contraseña `password123`.

## 0. Preparar (una vez)

```bash
git switch feature/r5-estoy-vendiendo
docker compose up -d
npm run migrate:up          # crea la tabla de avisos (migración senales-venta)
```

- **Solo PC:** `npx pm2 startOrReload ecosystem.config.cjs --only ruteando-backend,ruteando-frontend` y abrir `http://localhost:3001`.
- **Celular:** `bash scripts/dev-lan.sh --prod-frontend` (con `next dev` la app se queda en "Cargando sesión…" por la red local, CLAUDE.md §24) y abrir en el celular la IP que imprime el script, puerto 3001.

## 1. El vendedor avisa (PC y celular)

1. Entra como `demo-arepas-dona-rosa@ruteando.test`. Debes aterrizar en tu negocio.
2. **Deberías ver**, arriba, antes de los interruptores, una tarjeta "¿Estás vendiendo ahora?" con el botón **"Estoy vendiendo ahora"**.
3. Tócalo. **Deberías ver**: "Estás vendiendo ahora · Confirmado hace instantes · se vence en 60 min", los botones **"Sigo vendiendo"** y **"Ya no estoy vendiendo"**, y la insignia verde "Confirmado hace instantes" entre las insignias del negocio.
4. Toca "Sigo vendiendo" enseguida. **Deberías ver**: "Tu aviso ya estaba al día" (antes de 5 minutos no se crea un aviso nuevo).
5. Espera 1–2 minutos sin tocar nada: el texto cambia a "Confirmado hace 1 min · se vence en 59 min" (se actualiza cada 30 s).

## 2. Lo que ve un cliente

1. En otra ventana privada (o en el otro dispositivo), sin sesión o como consumidor, abre el mapa y busca "Arepas Doña Rosa".
2. **Deberías ver** "Vendiendo ahora" en su fila del carrusel "Disponibles ahora" y "Confirmado hace X" en su tarjeta y en su perfil.
3. **No deberías ver** la tarjeta del vendedor (solo la ve el dueño).

## 3. Apagar

1. Como vendedor, toca "Ya no estoy vendiendo". **Deberías ver** otra vez "¿Estás vendiendo ahora?" y "Listo: ya no apareces como vendiendo ahora". No pide confirmación: se puede volver a avisar al instante.
2. En la ventana del cliente, recarga. **Deberías ver** que la insignia desapareció.

## 4. "El aviso más reciente manda" con una pregunta

1. Como vendedor: Perfil (engranaje) → Configuración → "Activar notificaciones". Vuelve a tu negocio y toca "Estoy vendiendo ahora".
2. Como consumidor (registra uno si no tienes), abre Arepas Doña Rosa y toca "¿Está vendiendo ahora?".
3. Como vendedor, en "Te preguntan si sigues vendiendo" toca la X (no estoy vendiendo). **Deberías ver** que la tarjeta vuelve a "¿Estás vendiendo ahora?" al instante, y el cliente, al recargar, ya no ve la insignia. Antes de R5 el "sí" anterior seguía mostrándose hasta 60 minutos.

## 5. Casos de borde

- **Fuera de horario:** entra como `demo-empanadas-el-fogon@ruteando.test`. Su horario es de 8:00 a 20:00 y cierra los miércoles, así que prueba después de las 8 p. m., antes de las 8 a. m. o un miércoles. Toca "Estoy vendiendo ahora". **Deberías ver**: "Según tu horario ahora estás cerrado. Si estás vendiendo, actualiza tu horario o tus puntos por hora." (Dentro de su horario el aviso funciona normal.)
- **Ubicación en vivo (ambulante):** entra como `demo-tintos-don-efra@ruteando.test` sin aviso vigente y enciende "Compartir mi ubicación en vivo" (dentro de una de sus franjas). **Deberías ver**, debajo, "Estás compartiendo tu ubicación en vivo. ¿Avisas también que estás vendiendo?" con su botón.
- **Celular pequeño:** en la vista de iPhone SE del navegador o en el Nubia, los dos botones se apilan uno sobre otro y nada se corta.

## Qué reportar

Cualquier texto confuso, un botón que no responda, algo tapado por los botones flotantes, o una diferencia entre lo que ve el vendedor y lo que ve el cliente.
