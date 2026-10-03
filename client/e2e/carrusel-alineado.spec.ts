import { expect, test } from "@playwright/test";

/**
 * Carrusel del mapa (pedido del usuario, 2026-09-29): todas las tarjetas
 * se alinean igual que la primera. Antes (snap-center) la primera empezaba
 * a la izquierda y las siguientes quedaban centradas.
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["geolocation"],
  geolocation: { latitude: 4.6083, longitude: -74.2188 },
});

test("la segunda tarjeta queda donde estaba la primera al deslizar", async ({ page }) => {
  const email = `e2e-carrusel-${Date.now()}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Cliente Carrusel", email, password: "password123", role: "consumer" }),
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
  await page.getByLabel(/contraseña/i).first().fill("password123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");

  const tarjetas = page.locator("[data-business-id]");
  await expect(tarjetas.nth(1)).toBeAttached();
  const inicial = (await tarjetas.nth(0).boundingBox())!.x;
  // Un deslizamiento corto: el "imán" del carrusel termina de acomodar la tarjeta.
  await tarjetas.nth(0).evaluate((el) => el.parentElement!.scrollBy({ left: 120 }));
  await page.waitForTimeout(900);
  const segunda = (await tarjetas.nth(1).boundingBox())!.x;
  expect(Math.abs(segunda - inicial)).toBeLessThanOrEqual(2);
});
