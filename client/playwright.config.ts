import { defineConfig } from "@playwright/test";

/**
 * Pruebas de navegador (e2e/). No levantan nada por su cuenta: necesitan
 * el backend y el frontend ya corriendo (pm2 o `bash scripts/dev-lan.sh`)
 * y los datos de demo sembrados (`npm run seed:demo` en la raíz).
 *
 * E2E_BASE_URL cambia a dónde apuntan (por defecto http://localhost:3001).
 * No corren en CI todavía — el pipeline no levanta el frontend.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
  },
});
