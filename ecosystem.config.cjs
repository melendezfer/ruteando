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
  ],
};
