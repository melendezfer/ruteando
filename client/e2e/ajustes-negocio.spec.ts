import { expect, test, type Page } from "@playwright/test";

/**
 * Perfil 2.0, Etapa 1 — "Ajustes del negocio" (C3, docs/specs/perfil-2.md §5).
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 * Deja el negocio de demo como estaba (afterAll).
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DUENO = "demo-arepas-dona-rosa@ruteando.test";
const NEGOCIO = "Arepas Doña Rosa";

interface Original {
  id: string;
  token: string;
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  seatingAvailable: boolean;
  location: { type: string; referenceAddress: string | null; latitude: number; longitude: number; showExactLocation: boolean };
}

let original: Original;

async function login(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return res.accessToken;
}

test.beforeAll(async () => {
  const token = await login(DUENO);
  // El del propio dueño (el seed tiene otro negocio con el mismo nombre y otro dueño).
  const list = await fetch(`${API}/users/me/businesses?limit=10`, {
    headers: { authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const id = list.data.find((b: { name: string }) => b.name === NEGOCIO).id;
  const p = await fetch(`${API}/businesses/${id}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
  original = {
    id,
    token,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    contactPhone: p.contactPhone,
    seatingAvailable: p.seatingAvailable,
    location: {
      type: p.location.type,
      referenceAddress: p.location.referenceAddress,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
      showExactLocation: p.location.showExactLocation,
    },
  };
});

test.afterAll(async () => {
  const headers = { "content-type": "application/json", authorization: `Bearer ${original.token}` };
  await fetch(`${API}/businesses/${original.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: original.name,
      description: original.description ?? "",
      categoryId: original.categoryId,
      contactPhone: original.contactPhone,
      seatingAvailable: original.seatingAvailable,
    }),
  });
  await fetch(`${API}/businesses/${original.id}/location`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...original.location, referenceAddress: original.location.referenceAddress ?? undefined }),
  });
});

async function entrar(page: Page, email = DUENO) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

const FAMILIAS = ["Identidad", "Cómo comprar", "Ubicación", "Horario", "Confianza", "Herramientas"];

test.describe("Ajustes del negocio", () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true });

  test("el perfil del dueño ya no es la lista larga: los ajustes están en su pantalla", async ({ page }) => {
    await entrar(page);
    await page.goto(`/negocios/${original.id}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Así ven tu negocio tus clientes.")).toBeVisible();
    for (const viejo of ["Hago domicilios propios", "Tengo bancas", "Código QR", "Ideas de tus clientes"]) {
      await expect(page.getByText(viejo, { exact: false })).toHaveCount(0);
    }
    await page.getByRole("link", { name: "Ajustes del negocio" }).first().click();
    await page.waitForURL(`**/negocios/${original.id}/ajustes`);
    for (const familia of FAMILIAS) {
      const boton = page.getByRole("button", { name: new RegExp(`^${familia}`) });
      await expect(boton).toBeVisible();
      await expect(boton).toHaveAttribute("aria-expanded", "false");
    }
    await expect(page.getByRole("link", { name: /Mi cuenta/ })).toBeVisible();
    // Resumen con la familia cerrada.
    await expect(page.getByRole("button", { name: /^Identidad/ })).toContainText(NEGOCIO);
  });

  test("editar identidad; un interruptor después no devuelve el nombre viejo", async ({ page }) => {
    await entrar(page);
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Identidad/ }).click();
    const nuevo = `${NEGOCIO} (prueba)`;
    await page.getByLabel("Nombre del negocio").fill(nuevo);
    await page.getByLabel("Descripción corta").fill("Arepas de la esquina, prueba de ajustes.");
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Identidad/ })).toContainText(nuevo);

    await page.getByRole("button", { name: /^Cómo comprar/ }).click();
    const bancas = page.getByRole("switch", { name: /bancas/i });
    const antes = await bancas.getAttribute("aria-checked");
    await bancas.click();
    await expect(bancas).toHaveAttribute("aria-checked", antes === "true" ? "false" : "true");

    const p = await fetch(`${API}/businesses/${original.id}`).then((r) => r.json());
    expect(p.name).toBe(nuevo);
    expect(p.description).toBe("Arepas de la esquina, prueba de ajustes.");
  });

  test("mover el pin más de 30 m pregunta por la referencia", async ({ page, context }) => {
    // ~110 m al norte del punto guardado.
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: original.location.latitude + 0.001, longitude: original.location.longitude });
    await entrar(page);
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Ubicación/ }).click();
    await expect(page.getByLabel("Referencia (cómo te encuentran)")).toHaveValue(original.location.referenceAddress ?? "");
    await page.getByRole("button", { name: "Usar mi ubicación actual" }).click();
    await page.getByRole("button", { name: "Guardar ubicación" }).click();
    await expect(page.getByText(/Moviste tu punto 1\d\d m\. ¿Cambió tu referencia\?/)).toBeVisible();
    await page.getByLabel("Nueva referencia").fill("Frente a la panadería, prueba");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(/Moviste tu punto/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Ubicación/ })).toContainText("Frente a la panadería, prueba");

    const p = await fetch(`${API}/businesses/${original.id}`, {
      headers: { authorization: `Bearer ${original.token}` },
    }).then((r) => r.json());
    expect(p.location.referenceAddress).toBe("Frente a la panadería, prueba");
    expect(p.location.latitude).toBeCloseTo(original.location.latitude + 0.001, 5);
  });

  test("cambiar solo la referencia no pregunta nada", async ({ page }) => {
    await entrar(page);
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Ubicación/ }).click();
    await page.getByLabel("Referencia (cómo te encuentran)").fill("Esquina del CAI, prueba 2");
    await page.getByRole("button", { name: "Guardar ubicación" }).click();
    await expect(page.getByRole("button", { name: /^Ubicación/ })).toContainText("Esquina del CAI, prueba 2");
    await expect(page.getByText(/Moviste tu punto/)).toHaveCount(0);
  });

  test("horario editable y resumido", async ({ page }) => {
    await entrar(page);
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    const horario = page.getByRole("button", { name: /^Horario/ });
    await expect(horario).toContainText(/Hoy 00:00–23:59 · abre 7 días/);
    await horario.click();
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("Horario guardado.")).toBeVisible();
  });

  test("otra persona no puede entrar a los ajustes", async ({ page }) => {
    await entrar(page, "demo-perros-el-parche@ruteando.test");
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    await expect(page.getByText("Solo el dueño del negocio puede cambiar sus ajustes.")).toBeVisible();
  });
});

test.describe("Ajustes a 320 px", () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test("sin desplazamiento horizontal, con todas las familias abiertas", async ({ page }) => {
    await entrar(page);
    await page.goto(`/negocios/${original.id}/ajustes`, { waitUntil: "networkidle" });
    for (const familia of FAMILIAS) await page.getByRole("button", { name: new RegExp(`^${familia}`) }).click();
    await page.waitForTimeout(800);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(320);
  });
});
