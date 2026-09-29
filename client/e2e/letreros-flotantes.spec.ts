import { expect, test, type Page } from "@playwright/test";

/**
 * 1a (fix/pulido-visual): los letreros de los flotantes se ven solos solo
 * en las primeras 3 visitas; después, solo al mantener presionado (o al
 * pasar el mouse). El aria-label está siempre.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";

async function idDeNegocio(nombre: string): Promise<string> {
  const res = await fetch(`${API}/businesses?q=${encodeURIComponent(nombre)}&limit=5`).then((r) => r.json());
  const negocio = res.data.find((b: { name: string }) => b.name === nombre);
  if (!negocio) throw new Error(`No encontré "${nombre}" (npm run seed:demo)`);
  return negocio.id;
}

/** Abre el perfil con el contador de visitas previas ya fijado. */
async function abrirConVisitasPrevias(page: Page, previas: number) {
  await page.addInitScript((n) => {
    if (!window.sessionStorage.getItem("ruteando.flotantes.contada")) {
      window.localStorage.setItem("ruteando.flotantes.visitas", String(n));
    }
  }, previas);
  await page.goto(`/negocios/${await idDeNegocio("Arepas Doña Rosa")}`, { waitUntil: "networkidle" });
}

const letreroMapa = (page: Page) =>
  page.locator("[data-floating-action] [data-floating-label]", { hasText: "Mapa" });
const botonMapa = (page: Page) => page.getByRole("button", { name: "Volver al mapa" });

test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true });

test("en la 3a visita el letrero se ve solo", async ({ page }) => {
  await abrirConVisitasPrevias(page, 2);
  await expect(letreroMapa(page)).toBeVisible();
});

test("desde la 4a visita solo el ícono; mantener presionado muestra el letrero sin activar la acción", async ({ page }) => {
  await abrirConVisitasPrevias(page, 3);
  const url = page.url();
  await expect(botonMapa(page)).toBeVisible();
  await expect(letreroMapa(page)).toBeHidden();

  const caja = (await botonMapa(page).boundingBox())!;
  await page.mouse.move(caja.x + caja.width - 10, caja.y + caja.height / 2);
  await botonMapa(page).dispatchEvent("pointerdown");
  await page.waitForTimeout(700);
  await expect(letreroMapa(page)).toBeVisible();
  await botonMapa(page).dispatchEvent("pointerup");
  await botonMapa(page).dispatchEvent("click");
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);

  await expect(letreroMapa(page)).toBeHidden({ timeout: 4000 });
});

test.describe("PC", () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1280, height: 800 } });

  test("pasar el mouse muestra el letrero", async ({ page }) => {
    await abrirConVisitasPrevias(page, 5);
    await expect(letreroMapa(page)).toBeHidden();
    await botonMapa(page).hover();
    await expect(letreroMapa(page)).toBeVisible();
  });
});
