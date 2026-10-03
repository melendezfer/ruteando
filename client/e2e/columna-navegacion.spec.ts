import { expect, test, type Page } from "@playwright/test";

/**
 * Etapa 1b (pedido del usuario, 2026-10-03; docs/specs/perfil-2.md §8.1):
 * - arriba solo "Volver" y el título, sin íconos de acción;
 * - una columna de botones de 44 px al costado derecho, zona media-baja
 *   (Buscar, Favoritos, Perfil y, con el mapa visible, Ubicarme), sin
 *   letreros a la vista;
 * - con una hoja o el teclado abiertos, un solo botón;
 * - las hojas reservan la franja de la columna (nada debajo).
 * Que el contenido no quede tapado al desplazarse lo prueba
 * flotantes-no-tapan.spec.ts.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const ANCHOS = [360, 390, 412];

async function crearConsumidor(): Promise<string> {
  const email = `e2e-columna-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Cliente Columna", email, password: PASSWORD, role: "consumer" }),
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

async function entrar(page: Page) {
  const email = await crearConsumidor();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function idDeNegocio(nombre: string): Promise<string> {
  const res = await fetch(`${API}/businesses?q=${encodeURIComponent(nombre)}&limit=5`).then((r) => r.json());
  const negocio = res.data.find((b: { name: string }) => b.name === nombre);
  if (!negocio) throw new Error(`No encontré "${nombre}" (npm run seed:demo)`);
  return negocio.id;
}

/** Botones de la columna, de arriba hacia abajo: nombre y caja. */
async function columna(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-floating-action] > button, [data-floating-action] > a")]
      .filter((el) => !el.hasAttribute("data-floating-tip"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const circulo = el.lastElementChild!.getBoundingClientRect();
        return {
          nombre: el.getAttribute("aria-label"),
          top: r.top,
          bottom: r.bottom,
          right: r.right,
          ancho: circulo.width,
          alto: circulo.height,
        };
      }),
  );
}

/** Botones o enlaces en la franja de arriba (salvo "Volver" y los del mapa). */
async function accionesArriba(page: Page, alto = 64) {
  return page.evaluate((limite) => {
    return [...document.querySelectorAll<HTMLElement>("a, button")]
      .filter((el) => {
        if (el.closest("[data-floating-action], .leaflet-container")) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && r.top < limite && r.bottom > 0;
      })
      .map((el) => el.getAttribute("aria-label") ?? el.innerText.trim())
      .filter((nombre) => nombre !== "Volver");
  }, alto);
}

async function cerrarAviso(page: Page) {
  const aviso = page.locator("[data-floating-tip]");
  if (await aviso.isVisible()) await aviso.click();
}

for (const ancho of ANCHOS) {
  test.describe(`columna de navegación a ${ancho} px`, () => {
    test.use({
      viewport: { width: ancho, height: 800 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 4.6083, longitude: -74.2188 },
    });

    test("mapa: 4 botones de 44 px al costado derecho, zona media-baja, sin letreros", async ({ page }) => {
      await entrar(page);
      await page.goto("/mapa", { waitUntil: "networkidle" });
      await cerrarAviso(page);
      const botones = await columna(page);
      expect(botones.map((b) => b.nombre)).toEqual(["Buscar", "Favoritos", "Perfil", "Mi ubicación"]);
      for (const b of botones) {
        expect(Math.round(b.ancho)).toBe(44);
        expect(Math.round(b.alto)).toBe(44);
        expect(ancho - b.right).toBeLessThanOrEqual(16);
      }
      // Zona media-baja: empieza por debajo de la mitad de arriba y termina antes del último 10 %.
      expect(botones[0].top).toBeGreaterThan(800 * 0.35);
      expect(botones[botones.length - 1].bottom).toBeLessThan(800 * 0.9);
      await expect(page.locator("[data-floating-label]:visible")).toHaveCount(0);
    });

    test("mapa: con la hoja de búsqueda abierta queda un solo botón, que la cierra, y la hoja no pasa por la columna", async ({ page }) => {
      await entrar(page);
      await page.goto("/mapa", { waitUntil: "networkidle" });
      await cerrarAviso(page);
      await page.getByRole("button", { name: "Buscar" }).click();
      const hoja = page.locator("[data-search-sheet]");
      await expect(hoja).toBeVisible();
      const botones = await columna(page);
      expect(botones.map((b) => b.nombre)).toEqual(["Volver al mapa"]);
      const cajaHoja = (await hoja.boundingBox())!;
      expect(cajaHoja.x + cajaHoja.width).toBeLessThanOrEqual(ancho - 56);
      await page.getByRole("button", { name: "Volver al mapa" }).click();
      await expect(hoja).toBeHidden();
    });

    test("buscar: arriba solo Volver y el título; con el teclado abierto, un solo botón", async ({ page }) => {
      await entrar(page);
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await cerrarAviso(page);
      await expect(page.getByRole("heading", { level: 1, name: "Buscar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
      expect(await accionesArriba(page)).toEqual([]);
      expect((await columna(page)).map((b) => b.nombre)).toEqual(["Buscar", "Favoritos", "Perfil"]);
      // Teclado: en táctil, un campo de texto con el foco.
      await page.getByRole("textbox", { name: "Buscar" }).focus();
      await expect.poll(async () => (await columna(page)).map((b) => b.nombre)).toEqual(["Volver al mapa"]);
      await page.getByRole("textbox", { name: "Buscar" }).blur();
      await expect.poll(async () => (await columna(page)).length).toBe(3);
    });

    test("cuenta: arriba solo Volver y 'Mi cuenta'; cerrar sesión al final", async ({ page }) => {
      await entrar(page);
      await page.goto("/cuenta", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
      expect(await accionesArriba(page)).toEqual([]);
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    });

    test("perfil de un negocio: arriba solo Volver; WhatsApp y Cómo llegar en el contenido", async ({ page }) => {
      const id = await idDeNegocio("Arepas Doña Rosa");
      await entrar(page);
      await page.goto(`/negocios/${id}`, { waitUntil: "networkidle" });
      await cerrarAviso(page);
      expect(await accionesArriba(page)).toEqual([]);
      const llegar = page.getByRole("link", { name: "Cómo llegar" });
      await expect(llegar).toBeVisible();
      await expect(llegar).not.toHaveAttribute("data-floating-action");
      expect(await llegar.evaluate((el) => el.closest("[data-floating-action]") === null)).toBe(true);
      await expect(page.getByRole("button", { name: "Agregar a favoritos" })).toBeVisible();
      expect((await columna(page)).map((b) => b.nombre)).toEqual(["Buscar", "Favoritos", "Perfil"]);
    });
  });
}
