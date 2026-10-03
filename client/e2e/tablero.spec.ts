import { expect, test, type Page } from "@playwright/test";

/**
 * Perfil 2.0, Etapa 2 — tablero del día (C2) + R3, R4 y R14.
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DIAS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// Limpieza: cada prueba cierra los negocios que creó (si quedan "pendientes",
// llenan la cola del administrador en la base de desarrollo).
const creados: { token: string; id: string }[] = [];
test.afterEach(async () => {
  for (const { token, id } of creados.splice(0)) {
    await fetch(`${API}/businesses/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  }
});

interface Vendedor {
  email: string;
  token: string;
}

async function crearVendedor(): Promise<Vendedor> {
  const email = `e2e-tablero-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Vendedor Tablero", email, password: PASSWORD, role: "vendor" }),
  }).then((r) => r.json());
  for (const type of ["data_processing", "terms_conditions"]) {
    await fetch(`${API}/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${reg.accessToken}` },
      body: JSON.stringify({ type, textVersion: "1.0" }),
    });
  }
  return { email, token: reg.accessToken };
}

async function llamar(token: string, metodo: string, ruta: string, body?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return r.status === 204 ? null : r.json();
}

async function crearNegocio(v: Vendedor, { ubicar = true } = {}): Promise<string> {
  const categorias = await fetch(`${API}/categories`).then((r) => r.json());
  const n = await llamar(v.token, "POST", "/businesses", {
    name: "Arepas del tablero",
    categoryId: categorias[0].id,
    contactPhone: "3001112233",
  });
  creados.push({ token: v.token, id: n.id });
  if (ubicar) {
    await llamar(v.token, "PUT", `/businesses/${n.id}/location`, {
      type: "fixed",
      latitude: 4.6083,
      longitude: -74.2188,
    });
    await llamar(
      v.token,
      "PUT",
      `/businesses/${n.id}/schedule`,
      DIAS.map((day) => ({ day, openTime: "00:00", closeTime: "23:59" })),
    );
  }
  return n.id;
}

async function entrar(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

function cajasSeCruzan(a: DOMRect | { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("R3: marcar agotado con un toque y deshacer; el aviso no pasa por la columna", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v);
  const pan = await llamar(v.token, "POST", `/businesses/${id}/products`, { name: "Pan de bono", price: 2000, available: true });
  await entrar(page, v.email);
  await page.waitForURL("**/tablero", { timeout: 20_000 });

  const interruptor = page.getByRole("switch", { name: /Pan de bono/ });
  await expect(interruptor).toHaveAttribute("aria-checked", "true");
  await interruptor.click();
  await expect(interruptor).toHaveAttribute("aria-checked", "false");
  await expect(interruptor).toHaveText("Agotado");
  expect((await llamar(v.token, "GET", `/businesses/${id}`)).products[0].available).toBe(false);

  const aviso = page.locator("[data-undo-toast]");
  await expect(aviso).toContainText("Pan de bono");
  // El aviso no pasa por la franja de la columna de navegación.
  const cajaAviso = (await aviso.boundingBox())!;
  for (const boton of await page.locator("[data-floating-action] > button").all()) {
    expect(cajasSeCruzan(cajaAviso, (await boton.boundingBox())!)).toBe(false);
  }
  await aviso.getByRole("button", { name: "Deshacer" }).click();
  await expect(interruptor).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await llamar(v.token, "GET", `/businesses/${id}`)).products[0].available).toBe(true);
  expect(pan.id).toBeTruthy();
});

test("Tu semana cuenta visitas y contactos (WhatsApp + Cómo llegar)", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v);
  for (const type of ["business_view", "business_view", "contact_click", "directions_click"]) {
    await fetch(`${API}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, businessId: id }),
    });
  }
  await entrar(page, v.email);
  await page.waitForURL("**/tablero", { timeout: 20_000 });
  const semana = page.locator("section", { has: page.getByRole("heading", { name: "Tu semana" }) });
  await expect(semana.locator('dt:text-is("Visitas al perfil") + dd')).toHaveText("2");
  await expect(semana.locator('dt:text-is("Contactos") + dd')).toHaveText("2");
});

test("Atajos: Publicar oferta abre el formulario con la oferta encendida; Ver como cliente", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v);
  await entrar(page, v.email);
  await page.waitForURL("**/tablero", { timeout: 20_000 });
  await page.getByRole("link", { name: "Publicar oferta" }).click();
  await page.waitForURL(`**/negocios/${id}`);
  await expect(page.getByRole("switch", { name: /oferta con vigencia/i })).toBeChecked();
  await page.goto("/tablero", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Ver como cliente" }).click();
  await page.waitForURL(`**/negocios/${id}?vista=cliente`);
  await expect(page.getByRole("link", { name: "Volver a mi tablero" })).toBeVisible();
});

test("R4: borrar un producto pide confirmación con la hoja de la app, no con window.confirm", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v);
  await llamar(v.token, "POST", `/businesses/${id}/products`, { name: "Chicha", price: 3000, available: true });
  let dialogoNativo = false;
  page.on("dialog", async (d) => {
    dialogoNativo = true;
    await d.dismiss();
  });
  await entrar(page, v.email);
  await page.goto(`/negocios/${id}`, { waitUntil: "networkidle" });
  // Editar y eliminar están en la fila desplegada.
  await page.getByRole("button", { name: /^Chicha/ }).click();
  await page.getByRole("button", { name: /Eliminar Chicha/i }).click();
  const hoja = page.getByRole("alertdialog");
  await expect(hoja).toContainText("¿Eliminar");
  await hoja.getByRole("button", { name: "Cancelar" }).click();
  await expect(hoja).toBeHidden();
  expect((await llamar(v.token, "GET", `/businesses/${id}`)).products).toHaveLength(1);
  await page.getByRole("button", { name: /Eliminar Chicha/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await expect.poll(async () => (await llamar(v.token, "GET", `/businesses/${id}`)).products.length).toBe(0);
  expect(dialogoNativo).toBe(false);
});

test("R14: la hoja de confirmación queda por encima del mapa chico (paneles de Leaflet)", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v, { ubicar: false });
  await entrar(page, v.email);
  await page.goto(`/negocios/nuevo?negocio=${id}`, { waitUntil: "networkidle" });
  const mapa = page.getByRole("region", { name: "Mapa para ubicar tu negocio" });
  await expect(mapa.locator(".leaflet-marker-icon")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const caja = (await mapa.boundingBox())!;
  const encima = await page.evaluate(
    ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-confirm-sheet]")),
    { x: caja.x + caja.width / 2, y: caja.y + 20 },
  );
  expect(encima).toBe(true);
  await page.getByRole("button", { name: "Seguir aquí" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
});

/** Controles que solo tiene el dueño: ninguno puede aparecer en "Ver como cliente". */
const CONTROL_DE_DUENO =
  /cambiar foto|subir foto|eliminar foto|editar|eliminar|agregar|ajustes|estoy vendiendo|ya no vendo|sigo vendiendo|responder|confirmar|declinar|verificar|publicar oferta|terminar registro|ideas de tus clientes|código qr/i;

async function controlesDeDueno(page: Page): Promise<string[]> {
  return page.evaluate((patron) => {
    const re = new RegExp(patron, "i");
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [role=switch], [role=checkbox]")) {
      if (el.closest("[data-floating-action], [data-client-preview]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const nombre = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      if (el instanceof HTMLInputElement && el.type === "file") out.push("input de archivo");
      else if (el.getAttribute("role") === "switch" || (el instanceof HTMLInputElement && el.type === "checkbox"))
        out.push(`interruptor "${nombre}"`);
      else if (re.test(nombre)) out.push(nombre);
    }
    return out;
  }, CONTROL_DE_DUENO.source);
}

test("Ver como cliente: exactamente la vista del cliente, sin ningún control del dueño", async ({ page }) => {
  const v = await crearVendedor();
  const id = await crearNegocio(v);
  await llamar(v.token, "POST", `/businesses/${id}/products`, { name: "Empanada", price: 1500, available: true });
  await entrar(page, v.email);
  await page.waitForURL("**/tablero", { timeout: 20_000 });

  // Control: en su vista de dueño SÍ hay controles de edición (la prueba los detecta).
  await page.goto(`/negocios/${id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Empanada/ }).click();
  expect((await controlesDeDueno(page)).length).toBeGreaterThan(0);

  await page.goto("/tablero", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Ver como cliente" }).click();
  await page.waitForURL(`**/negocios/${id}?vista=cliente`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-client-preview]")).toContainText("Vista de cliente");
  await page.getByRole("button", { name: /^Empanada/ }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await controlesDeDueno(page)).toEqual([]);
  // Lo que ve el cliente sí está: "Cómo llegar" y la calificación.
  await expect(page.getByRole("link", { name: "Cómo llegar" })).toBeVisible();
});
