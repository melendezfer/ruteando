import { expect, test, type Page } from "@playwright/test";

/**
 * Botón-ancla, etapa I1 (docs/integracion-ancla.md): infraestructura.
 * - Apagado (por defecto): RUTEANDO igual que antes (columna de navegación,
 *   sin ancla). El resto de la suite e2e corre en este modo con la bandera
 *   encendida: si algo cambiara con el ancla apagada, fallaría ahí.
 * - Completo / Solo menú: el ancla reemplaza la columna en el mismo lugar y
 *   ofrece lo mismo; cambiar de modo no reinicia la pantalla.
 * Requiere el frontend con NEXT_PUBLIC_ANCLA=1 (si no, se salta).
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["geolocation"],
  geolocation: { latitude: 4.6083, longitude: -74.2188 },
});

async function entrar(page: Page) {
  const email = `e2e-ancla-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Prueba Ancla", email, password: PASSWORD, role: "consumer" }),
  }).then((r) => r.json());
  for (const type of ["data_processing", "terms_conditions"]) {
    await fetch(`${API}/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.accessToken}` },
      body: JSON.stringify({ type, textVersion: "1.0" }),
    });
  }
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Elige el modo desde Cuenta → Configuración (salta la prueba sin la bandera). */
async function elegirModo(page: Page, nombre: RegExp) {
  await page.goto("/cuenta", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Configuración" }).click();
  const seccion = page.getByRole("heading", { name: "Botón para una mano" });
  test.skip(!(await seccion.isVisible()), "Frontend sin NEXT_PUBLIC_ANCLA=1");
  await page.getByRole("radio", { name: nombre }).check();
}

const ancla = (page: Page) => page.getByRole("button", { name: /^Menú/ });

async function pasarBienvenida(page: Page) {
  const derecha = page.getByRole("button", { name: "Derecha" });
  if (await derecha.isVisible().catch(() => false)) await derecha.click();
}

test("apagado por defecto: la columna de siempre y ningún ancla", async ({ page }) => {
  await entrar(page);
  await page.goto("/mapa", { waitUntil: "networkidle" });
  await expect(page.locator("[data-floating-action]")).toBeVisible();
  await expect(ancla(page)).toHaveCount(0);
});

test("Completo: el ancla reemplaza la columna en el mismo lugar y navega", async ({ page }) => {
  await entrar(page);
  // Dónde está la columna con el ancla apagada (su último botón, el del mapa).
  await page.goto("/mapa", { waitUntil: "networkidle" });
  const ultimo = (await page.locator("[data-floating-action] > button").last().boundingBox())!;

  await elegirModo(page, /Completo/);
  // Cambiar de modo no reinicia la pantalla: sigue en Configuración.
  await expect(page.getByRole("radio", { name: /Completo/ })).toBeChecked();
  await expect(page.getByRole("tab", { name: "Configuración" })).toHaveAttribute("aria-selected", "true");

  await page.goto("/mapa", { waitUntil: "networkidle" });
  await pasarBienvenida(page);
  await expect(page.locator("[data-floating-action]")).toHaveCount(0);
  await expect(ancla(page)).toHaveAttribute("aria-label", "Menú, sección Mapa");

  // Mismo lugar que la columna: dentro de la franja reservada (72 px a la
  // derecha, .reserva-columna) y a la altura del último botón ± media columna.
  const caja = (await ancla(page).boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(390 - 72);
  expect(caja.x + caja.width).toBeLessThanOrEqual(390);
  expect(Math.abs(caja.y + caja.height / 2 - (ultimo.y + ultimo.height / 2))).toBeLessThanOrEqual(110);
  // No tapa el crédito de OpenStreetMap (zona obligatoria).
  const credito = (await page.locator(".leaflet-control-attribution").boundingBox())!;
  const cruza =
    caja.x < credito.x + credito.width && caja.x + caja.width > credito.x && caja.y < credito.y + credito.height && caja.y + caja.height > credito.y;
  expect(cruza).toBe(false);

  // Lo mismo que la columna.
  await ancla(page).click();
  const opciones = await page.getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(opciones.sort()).toEqual(["Buscar", "Favoritos", "Mi ubicación", "Perfil"]);
  await page.getByRole("menuitem", { name: "Buscar" }).click();
  await expect(page.locator("[data-search-sheet]")).toBeVisible();

  // Fuera del mapa: "Atrás" y "Mapa".
  await page.goto("/buscar", { waitUntil: "networkidle" });
  await expect(ancla(page)).toHaveAttribute("aria-label", "Menú, sección Buscar");
  await ancla(page).click();
  await expect(page.getByRole("menuitem", { name: "Atrás" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Mapa" }).click();
  await page.waitForURL("**/mapa");
});

test("Solo menú también reemplaza la columna; volver a Apagado la trae de vuelta", async ({ page }) => {
  await entrar(page);
  await elegirModo(page, /Solo menú/);
  await page.goto("/buscar", { waitUntil: "networkidle" });
  await pasarBienvenida(page);
  await expect(ancla(page)).toBeVisible();
  await expect(page.locator("[data-floating-action]")).toHaveCount(0);

  await elegirModo(page, /Apagado/);
  await page.goto("/buscar", { waitUntil: "networkidle" });
  await expect(ancla(page)).toHaveCount(0);
  await expect(page.locator("[data-floating-action]")).toBeVisible();
});
