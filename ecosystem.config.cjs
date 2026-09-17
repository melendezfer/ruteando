// Procesos persistentes de desarrollo (backend + frontend), gestionados
// por pm2 — ver scripts/dev-lan.sh, que es quien los levanta/recarga.
// No reemplaza a Docker Compose (Postgres/MinIO, sección Épica 3 de
// CLAUDE.md): esos ya corren como daemon propio, sin depender de pm2 ni
// de esta terminal.
//
// Cada app carga sus propias variables de entorno por su cuenta al
// arrancar (`src/config/env.js` con dotenv para el backend,
// `.env.local`/`.env.development` de Next.js para el frontend) — no
// hace falta pasarlas acá.
module.exports = {
  apps: [
    {
      name: "ruteando-backend",
      cwd: __dirname,
      script: "src/server.js",
      env: { NODE_ENV: "development" },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "ruteando-frontend",
      cwd: `${__dirname}/client`,
      script: "npm",
      args: "run dev",
      autorestart: true,
      max_restarts: 10,
    },
    // Alternativa sin HMR para probar por LAN/celular (bug real — ver
    // CLAUDE.md sección 24, "Cargando sesión" colgado para siempre): el
    // socket de HMR de `next dev` puede fallar su handshake al acceder
    // por la IP de LAN en este entorno (WSL2 NAT + portproxy), y cuando
    // eso pasa React nunca llega a hidratar — ningún efecto de la app
    // corre, sin relación con ningún bug de la propia aplicación
    // (confirmado: mismo código, mismo acceso por LAN, funciona bien en
    // este mismo modo). `next start` (build de producción) no tiene
    // socket de HMR — nunca puede colgarse por esto. Nunca corre al
    // mismo tiempo que "ruteando-frontend" (los dos bindean :3001) —
    // scripts/dev-lan.sh --prod-frontend se encarga de que solo uno de
    // los dos esté activo en pm2 a la vez.
    {
      name: "ruteando-frontend-prod",
      cwd: `${__dirname}/client`,
      script: "npm",
      args: "run start",
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
