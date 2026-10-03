import { expect, test, type Page } from "@playwright/test";

/**
 * Letreros de los flotantes (pedido del usuario, 2026-09-29): NUNCA
 * aparecen solos. Solo al mantener presionado (táctil) o al pasar el mouse
 * (PC). La primera vez, un único aviso pequeño que se cierra con un toque.
 * Esta prueba falla si un letrero se ve sin interacción.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";

async function idDeNegocio(nombre: string): Promise<string> {
  const res = await fetch(`${API}/businesses?q=${encodeURIComponent(nombre)}&limit=5`).then((r) => r.json());
  return res.data.find((b: { name: string }) => b.name === nombre).id;
}

async function crearConsumidor(): Promise<string> {
  const email = `e2e-letreros-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Cliente Letreros", email, password: PASSWORD, role: "consumer" }),
  }).then((r) => r.json());
  for (const type of ["data_processing", "terms_conditions"]) {
    await fetch(`${API}/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.accessToken}` },
      body: JSON.stringify({ type, textVersion: "1.0" }),
    });
  }
  return email;
}

async function entrar(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

const letreros = (page: Page) => page.locator("[data-floating-action] [data-floating-label]");

async function ningunLetreroVisible(page: Page) {
  await page.waitForTimeout(600);
  const n = await letreros(page).count();
  for (let i = 0; i < n; i++) await expect(letreros(page).nth(i)).toBeHidden();
}

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("cuenta nueva: ningún letrero sin interacción en ninguna pantalla; un solo aviso que se cierra", async ({
    page,
  }) => {
    await entrar(page, await crearConsumidor());
    for (const ruta of ["/mapa", "/buscar", "/cuenta", `/negocios/${await idDeNegocio("Arepas Doña Rosa")}`]) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      await ningunLetreroVisible(page);
    }
    // El aviso de la primera vez: uno solo, pequeño, no bloquea; un toque en
    // cualquier parte lo cierra para siempre.
    const aviso = page.locator("[data-floating-tip]");
    await expect(aviso).toHaveCount(1);
    await expect(aviso).toContainText("Mantén pulsado");
    expect(await aviso.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    const caja = (await aviso.boundingBox())!;
    expect(caja.width).toBeLessThanOrEqual(56);
    await page.mouse.click(30, 300);
    await expect(aviso).toHaveCount(0);
    await page.goto("/mapa", { waitUntil: "networkidle" });
    await expect(page.locator("[data-floating-tip]")).toHaveCount(0);
    await ningunLetreroVisible(page);

    // Los botones conservan su nombre accesible.
    await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Perfil" })).toBeVisible();
  });

  test("mantener presionado muestra el letrero y no activa la acción", async ({ page }) => {
    // Etapa 1b: la columna solo aparece con sesión (un enlace compartido abierto sin sesión tiene solo "Volver").
    await entrar(page, await crearConsumidor());
    await page.goto(`/negocios/${await idDeNegocio("Arepas Doña Rosa")}`, { waitUntil: "networkidle" });
    const boton = page.getByRole("button", { name: "Buscar" });
    const url = page.url();
    await boton.dispatchEvent("pointerdown", { pointerType: "touch" });
    await page.waitForTimeout(700);
    await expect(page.locator("[data-floating-label]", { hasText: "Buscar" })).toBeVisible();
    await boton.dispatchEvent("pointerup", { pointerType: "touch" });
    await boton.dispatchEvent("click");
    await page.waitForTimeout(500);
    expect(page.url()).toBe(url);
    await expect(page.locator("[data-floating-label]", { hasText: "Buscar" })).toBeHidden({ timeout: 4000 });
  });
});

test.describe("PC", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("pasar el mouse muestra el letrero; al salir se esconde", async ({ page }) => {
    await entrar(page, await crearConsumidor());
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await ningunLetreroVisible(page);
    await page.getByRole("button", { name: "Perfil" }).hover();
    await expect(page.locator("[data-floating-label]", { hasText: "Perfil" })).toBeVisible();
    await page.mouse.move(10, 10);
    await expect(page.locator("[data-floating-label]", { hasText: "Perfil" })).toBeHidden();
  });
});
