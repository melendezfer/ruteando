import { expect, test, type Page } from "@playwright/test";

/**
 * Página principal del vendedor (pedido del usuario, 2026-09-29):
 * - sin negocio: "Registra tu negocio" destacado, que lleva al asistente;
 * - con negocio (en cualquier estado salvo cerrado, incluido pendiente): su
 *   negocio;
 * - con varios: el que su horario cubre ahora.
 * Cuenta nueva desde cero, registrada por la pantalla real.
 * Requisitos: backend + frontend corriendo.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function registrarVendedorPorPantalla(page: Page): Promise<string> {
  const email = `e2e-vendedor-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByLabel("Nombre completo").fill("Vendedora Prueba");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByLabel("Tengo un negocio (vendedor)").check();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /crear cuenta|registr/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), { timeout: 20_000 });
  return email;
}

async function token(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return res.accessToken;
}

async function crearNegocio(t: string, nombre: string, horario: "todo-el-dia" | "cerrado"): Promise<string> {
  const headers = { "content-type": "application/json", authorization: `Bearer ${t}` };
  const cats = await fetch(`${API}/categories`).then((r) => r.json());
  const negocio = await fetch(`${API}/businesses`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: nombre, categoryId: cats[0].id, contactPhone: "3001112233" }),
  }).then((r) => r.json());
  const dias = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  await fetch(`${API}/businesses/${negocio.id}/schedule`, {
    method: "PUT",
    headers,
    body: JSON.stringify(
      dias.map((day) =>
        horario === "todo-el-dia" ? { day, closed: false, openTime: "00:00", closeTime: "23:59" } : { day, closed: true },
      ),
    ),
  });
  return negocio.id;
}

test("vendedor nuevo: sin negocio ve 'Registra tu negocio'; con negocio aterriza en su tablero; con varios, AHORA y DESPUÉS", async ({
  page,
}) => {
  const email = await registrarVendedorPorPantalla(page);

  // 1. Sin negocio: la tarjeta destacada, que lleva al asistente.
  await expect(page.getByRole("heading", { name: "Registra tu negocio" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Registrar mi negocio" }).click();
  await page.waitForURL("**/negocios/nuevo");
  await expect(page.getByLabel("Nombre del negocio")).toBeVisible();

  // "Perfil" también la ofrece.
  await page.goto("/perfil", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Registra tu negocio" })).toBeVisible();

  // 2. Un negocio recién creado (pendiente de aprobación): aterriza en su
  // tablero del día (Perfil 2.0, Etapa 2).
  const t = await token(email);
  const abierto = await crearNegocio(t, "Tintos de prueba", "todo-el-dia");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForURL("**/tablero", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mi negocio hoy" })).toBeVisible();
  await expect(page.getByText("Tintos de prueba").first()).toBeVisible();

  // 3. Dos negocios: AHORA es el que su horario cubre ahora, aunque el otro
  // sea más nuevo; el cerrado va en DESPUÉS. "Perfil" también trae al tablero.
  const cerrado = await crearNegocio(t, "Chorizos de prueba", "cerrado");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForURL("**/tablero", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mis negocios de hoy" })).toBeVisible();
  const ahora = page.locator("section", { has: page.locator("#tablero-ahora") });
  await expect(ahora.getByText("Tintos de prueba")).toBeVisible();
  const despues = page.locator("section", { has: page.locator("#tablero-despues") });
  await expect(despues.getByText("Chorizos de prueba")).toBeVisible();
  await expect(despues.getByText("Cerrado hoy")).toBeVisible();
  await page.goto("/perfil", { waitUntil: "networkidle" });
  await page.waitForURL("**/tablero", { timeout: 15_000 });

  // Limpieza: cerrar los dos negocios de prueba.
  for (const id of [cerrado, abierto]) {
    await fetch(`${API}/businesses/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${t}` } });
  }
});
