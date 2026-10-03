import { expect, test, type Page } from "@playwright/test";

/**
 * A1 (fix/pulido-visual): ningún botón flotante tapa texto ni un control.
 *
 * Etapa 1b: los flotantes son una columna fija al costado derecho, zona
 * media-baja (`[data-floating-action]`), y el contenido reserva esa franja
 * (`.reserva-columna`), así que NADA debe quedar debajo en ninguna posición
 * del desplazamiento. La prueba mira arriba, a la mitad y al final: para
 * cada texto o control visible pregunta al navegador qué elemento está
 * encima de su centro y de sus esquinas (`document.elementFromPoint`). Si
 * es un flotante, está tapado. El aviso de la primera vez no deja pasar
 * toques por encima (no bloquea), así que además se compara su caja con la
 * de cada texto o control: no debe cruzarse con ninguno.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DUENO = "demo-arepas-dona-rosa@ruteando.test";
const CENTRO = { latitude: 4.6083, longitude: -74.2188 };

const PANTALLAS = [
  { nombre: "320", width: 320, height: 568 },
  { nombre: "412", width: 412, height: 839 },
];

async function crearConsumidor(): Promise<string> {
  const email = `e2e-flotantes-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const registro = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Cliente de prueba", email, password: PASSWORD, role: "consumer" }),
  }).then((r) => r.json());
  for (const type of ["data_processing", "terms_conditions"]) {
    await fetch(`${API}/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${registro.accessToken}` },
      body: JSON.stringify({ type, textVersion: "1.0" }),
    });
  }
  return email;
}

async function idDeNegocio(nombre: string): Promise<string> {
  const res = await fetch(`${API}/businesses?q=${encodeURIComponent(nombre)}&limit=5`).then((r) => r.json());
  const negocio = res.data.find((b: { name: string }) => b.name === nombre);
  if (!negocio) throw new Error(`No encontré "${nombre}" en los datos de demo (npm run seed:demo)`);
  return negocio.id;
}

async function entrar(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Baja hasta el final y devuelve los textos/controles que quedan bajo un flotante. */
async function tapadosAlFinal(page: Page): Promise<string[]> {
  // El aviso de la primera vez NO se cierra: tampoco debe tapar nada.
  const todos = new Set<string>();
  for (const fraccion of [0, 0.5, 1]) {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f), fraccion);
    await page.waitForTimeout(400);
    for (const t of await tapadosEnPantalla(page)) todos.add(t);
  }
  return [...todos];
}

async function tapadosEnPantalla(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const flotantes = [...document.querySelectorAll("[data-floating-action]")];
    if (flotantes.length === 0) return [];
    const esFlotante = (el: Element | null) => Boolean(el?.closest("[data-floating-action]"));
    const interactivo = "a, button, input, select, textarea, label, [role=button], [role=switch], [role=radio], [role=checkbox]";
    const candidatos = [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => {
      if (esFlotante(el) || el.closest(".leaflet-pane, .leaflet-control-zoom")) return false;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden" || estilo.display === "none" || Number(estilo.opacity) === 0) return false;
      const conTexto = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== "");
      return el.matches(interactivo) || conTexto;
    });
    const resultado: string[] = [];
    const aviso = document.querySelector("[data-floating-tip]")?.getBoundingClientRect();
    for (const el of candidatos) {
      const r = el.getBoundingClientRect();
      if (
        aviso &&
        r.width >= 2 &&
        r.left < aviso.right && r.right > aviso.left && r.top < aviso.bottom && r.bottom > aviso.top
      ) {
        resultado.push(`<${el.tagName.toLowerCase()}> bajo el aviso`);
      }
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= window.innerHeight) continue;
      const puntos = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
      ];
      const tapado = puntos.some(([x, y]) => {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
        return esFlotante(document.elementFromPoint(x, y));
      });
      if (tapado) {
        const texto = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
        resultado.push(`<${el.tagName.toLowerCase()}> "${texto}"`);
      }
    }
    return [...new Set(resultado)];
  });
}

for (const pantalla of PANTALLAS) {
  test.describe(`flotantes no tapan contenido — ${pantalla.nombre} px`, () => {
    test.use({
      viewport: { width: pantalla.width, height: pantalla.height },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: CENTRO,
    });

    test("tablero y perfil del negocio visto por su dueño", async ({ page }) => {
      await entrar(page, DUENO);
      await page.waitForURL("**/tablero", { timeout: 20_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "¿Qué se acabó?" })).toBeVisible();
      expect(await tapadosAlFinal(page)).toEqual([]);
      await page.getByRole("link", { name: "Ver como cliente" }).click();
      await page.waitForURL(/\/negocios\//, { timeout: 20_000 });
      await page.waitForLoadState("networkidle");
      // A2: el dueño no ve las acciones del cliente sobre su propio negocio.
      await expect(page.getByRole("link", { name: "Contactar por WhatsApp" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Cómo llegar" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
      expect(await tapadosAlFinal(page)).toEqual([]);
    });

    test("perfil del negocio visto por un cliente (calificar)", async ({ page }) => {
      const id = await idDeNegocio("Arepas Doña Rosa");
      await entrar(page, await crearConsumidor());
      await page.goto(`/negocios/${id}`, { waitUntil: "networkidle" });
      await expect(page.getByText(/califica/i).first()).toBeVisible();
      expect(await tapadosAlFinal(page)).toEqual([]);
    });

    test("perfil con insignia de oferta en la carta", async ({ page }) => {
      const id = await idDeNegocio("Fruver El Manantial");
      await page.goto(`/negocios/${id}`, { waitUntil: "networkidle" });
      expect(await tapadosAlFinal(page)).toEqual([]);
    });

    test("cuenta: configuración (tipo de cuenta, eliminar cuenta)", async ({ page }) => {
      await entrar(page, await crearConsumidor());
      await page.goto("/cuenta", { waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Configuración" }).click();
      await expect(page.getByText(/tipo de cuenta/i)).toBeVisible();
      expect(await tapadosAlFinal(page)).toEqual([]);
    });

    test("mapa (logo, carrusel y nombres de los flotantes)", async ({ page }) => {
      await entrar(page, await crearConsumidor());
      await page.goto("/mapa", { waitUntil: "networkidle" });
      await expect(page.locator(".leaflet-control-attribution")).toBeVisible();
      expect(await tapadosAlFinal(page)).toEqual([]);
    });

    test("buscar", async ({ page }) => {
      await entrar(page, await crearConsumidor());
      await page.goto("/buscar", { waitUntil: "networkidle" });
      expect(await tapadosAlFinal(page)).toEqual([]);
    });
  });
}
