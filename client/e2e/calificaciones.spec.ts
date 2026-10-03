import { expect, test, type Page } from "@playwright/test";

/**
 * Calificaciones públicas al instante (regla del usuario, 2026-10-03;
 * docs/specs/perfil-2.md §3.6): "★ 4,5 · 2 calificaciones" en el perfil,
 * la hoja del mapa y el carrusel; una por persona (calificar de nuevo
 * reemplaza); el dueño no califica su propio negocio.
 * Requisitos: backend + frontend corriendo.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DIAS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const CENTRO = { latitude: 4.6083, longitude: -74.2188 };

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["geolocation"],
  geolocation: CENTRO,
});

async function cuenta(role: "consumer" | "vendor") {
  const email = `e2e-calif-${role}-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Prueba Calificación", email, password: PASSWORD, role }),
  }).then((r) => r.json());
  for (const type of ["data_processing", "terms_conditions"]) {
    await fetch(`${API}/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.accessToken}` },
      body: JSON.stringify({ type, textVersion: "1.0" }),
    });
  }
  return { email, token: reg.accessToken as string };
}

async function llamar(token: string, metodo: string, ruta: string, body?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return r.status === 204 ? null : r.json();
}

async function entrar(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function calificar(page: Page, estrellas: number) {
  await page.getByLabel(`${estrellas} estrella${estrellas === 1 ? "" : "s"}`, { exact: true }).click();
  await page.getByRole("button", { name: /Enviar mi aporte/ }).click();
}

test("se publica al instante, una por persona, y se ve en perfil, hoja del mapa y carrusel", async ({ page }) => {
  // Negocio propio de la prueba (el perfil por id se ve aunque esté pendiente de aprobación).
  const vendedor = await cuenta("vendor");
  const categorias = await fetch(`${API}/categories`).then((r) => r.json());
  const negocio = await llamar(vendedor.token, "POST", "/businesses", {
    name: `Calificaciones ${Date.now()}`,
    categoryId: categorias[0].id,
    contactPhone: "3001234567",
  });
  await llamar(vendedor.token, "PUT", `/businesses/${negocio.id}/location`, { type: "fixed", ...CENTRO, showExactLocation: true });
  await llamar(
    vendedor.token,
    "PUT",
    `/businesses/${negocio.id}/schedule`,
    DIAS.map((day) => ({ day, openTime: "00:00", closeTime: "23:59" })),
  );
  // Otra persona ya calificó (por la API).
  const otra = await cuenta("consumer");
  await llamar(otra.token, "POST", `/businesses/${negocio.id}/reviews`, { rating: 4 });

  const cliente = await cuenta("consumer");
  await entrar(page, cliente.email);
  await page.goto(`/negocios/${negocio.id}`, { waitUntil: "networkidle" });
  const resumen = page.locator("[data-rating-summary]").first();
  await expect(resumen).toHaveAttribute("aria-label", /^4,0 de 5 estrellas, 1 calificación$/);

  // Califica: se publica al instante (sin recargar).
  await calificar(page, 5);
  await expect(page.getByText(/Gracias por tu aporte/)).toBeVisible();
  await expect(resumen).toHaveAttribute("aria-label", /^4,5 de 5 estrellas, 2 calificaciones$/);

  // Califica de nuevo (otra visita): reemplaza la anterior, no cuenta doble.
  await page.reload({ waitUntil: "networkidle" });
  await calificar(page, 3);
  await expect(page.getByText(/Actualizamos tu calificación/)).toBeVisible();
  await expect(page.locator("[data-rating-summary]").first()).toHaveAttribute(
    "aria-label",
    /^3,5 de 5 estrellas, 2 calificaciones$/,
  );

  // El dueño no ve el formulario en su propio negocio (el backend además responde 403).
  const res = await fetch(`${API}/businesses/${negocio.id}/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${vendedor.token}` },
    body: JSON.stringify({ rating: 5 }),
  });
  expect(res.status).toBe(403);

  await llamar(vendedor.token, "DELETE", `/businesses/${negocio.id}`);
});

test("el carrusel y la hoja del mapa muestran la calificación pública", async ({ page }) => {
  const cliente = await cuenta("consumer");
  // Un negocio de demo visible en el mapa, con una calificación nueva.
  const demo = await fetch(`${API}/businesses/nearby?lat=${CENTRO.latitude}&lng=${CENTRO.longitude}&radiusKm=2&openNow=true&limit=5`).then(
    (r) => r.json(),
  );
  const negocio = demo.data[0];
  const propia = await llamar(cliente.token, "POST", `/businesses/${negocio.id}/reviews`, { rating: 5 });
  const actual = await fetch(`${API}/businesses/${negocio.id}`).then((r) => r.json());
  const n = actual.reviewCount as number;

  await entrar(page, cliente.email);
  await page.goto("/mapa", { waitUntil: "networkidle" });
  const tarjeta = page.locator(`[data-business-id="${negocio.id}"]`);
  await expect(tarjeta.locator("[data-rating-summary]")).toHaveAttribute(
    "aria-label",
    new RegExp(`, ${n} calificaci(ón|ones)$`),
  );
  // Hoja del mapa (resumen del negocio).
  await tarjeta.getByRole("button").first().click();
  const hoja = page.locator("[data-rating-summary]").last();
  await expect(hoja).toHaveAttribute("aria-label", new RegExp(`, ${n} calificaci(ón|ones)$`));

  // Limpieza: no dejar calificaciones de prueba en los negocios de demo.
  await llamar(cliente.token, "DELETE", `/reviews/${propia.id}`);
});
