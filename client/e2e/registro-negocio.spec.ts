import { expect, test, type Page } from "@playwright/test";

/**
 * Asistente de registro (pedido del usuario, 2026-09-29, tras quedar
 * atrapado en el paso de ubicación en el celular):
 * - "Guardar y terminar después" visible en todos los pasos; guarda y se
 *   retoma después;
 * - sin ubicación del navegador: mapa con pin (centrado en Ciudad Verde),
 *   coordenadas como opción avanzada plegada;
 * - sin ubicar, el mensaje dice que falta ubicar el negocio (no
 *   "fuera de Cundinamarca").
 * Sin permiso de ubicación a propósito: es el caso que atrapaba.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

async function nuevoVendedor(page: Page): Promise<string> {
  const email = `e2e-registro-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Vendedor Registro", email, password: PASSWORD, role: "vendor" }),
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
  return reg.accessToken;
}

async function llenarDetalles(page: Page, nombre: string) {
  await page.getByLabel("Nombre del negocio").fill(nombre);
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.getByLabel("Teléfono de contacto (WhatsApp)").fill("3004445566");
}

test("paso de ubicación: mapa con pin, mensaje claro, y guardar para terminar después", async ({ page }) => {
  const token = await nuevoVendedor(page);
  await page.goto("/negocios/nuevo", { waitUntil: "networkidle" });
  const guardarDespues = page.getByRole("button", { name: "Guardar y terminar después" });
  await expect(guardarDespues).toBeVisible();

  await llenarDetalles(page, "Empanadas del registro");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 2: mapa y pin, "Guardar y terminar después" sigue ahí, coordenadas plegadas.
  await expect(page.getByRole("region", { name: "Mapa para ubicar tu negocio" })).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toBeVisible();
  await expect(guardarDespues).toBeVisible();
  await expect(page.getByLabel("Latitud")).toBeHidden();

  // Sin ubicar: el mensaje dice que falta ubicar el negocio.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Falta ubicar tu negocio/)).toBeVisible();
  await expect(page.getByText(/Cundinamarca/)).toHaveCount(0);

  // Tocar el mapa ubica el pin y deja seguir.
  const mapa = page.getByRole("region", { name: "Mapa para ubicar tu negocio" });
  const caja = (await mapa.boundingBox())!;
  await page.mouse.click(caja.x + caja.width * 0.6, caja.y + caja.height * 0.4);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: "Finalizar registro" })).toBeVisible();

  // Paso 3: guardar y terminar después → a su tablero, con "Terminar registro" en Pendientes.
  await guardarDespues.click();
  await page.waitForURL("**/tablero", { timeout: 20_000 });
  const hoy = await fetch(`${API}/users/me/businesses/today`, { headers: { authorization: `Bearer ${token}` } }).then(
    (r) => r.json(),
  );
  const negocioId: string = hoy.data[0].id;
  const p = await fetch(`${API}/businesses/${negocioId}`, { headers: { authorization: `Bearer ${token}` } }).then((r) =>
    r.json(),
  );
  expect(p.name).toBe("Empanadas del registro");
  expect(p.location).toBeTruthy();
  expect(p.location.latitude).toBeGreaterThan(4.5);

  await page.getByRole("link", { name: /Terminar registro/ }).click();
  await expect(page.getByRole("button", { name: "Finalizar registro" })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar registro" }).click();
  await expect(page.getByText(/Listo|registrado/i).first()).toBeVisible();

  await fetch(`${API}/businesses/${negocioId}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
});

test("guardar en el paso 1, sin negocio creado todavía: se retoma con lo escrito", async ({ page }) => {
  await nuevoVendedor(page);
  await page.goto("/negocios/nuevo", { waitUntil: "networkidle" });
  await page.getByLabel("Nombre del negocio").fill("Solo el nombre");
  await page.getByRole("button", { name: "Guardar y terminar después" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
  await page.getByRole("link", { name: "Continuar mi registro" }).click();
  await expect(page.getByLabel("Nombre del negocio")).toHaveValue("Solo el nombre");
});
