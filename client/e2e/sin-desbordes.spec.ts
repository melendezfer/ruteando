import { expect, test, type Page } from "@playwright/test";

/**
 * Pantallas angostas (pedido del usuario, 2026-09-29): ningún elemento se
 * sale del ancho de su contenedor, y ningún control de una hoja queda
 * debajo de los botones flotantes. A 360, 390 y 412 px.
 *
 * "Se sale" = su borde izquierdo o derecho pasa el de su contenedor (el
 * ancestro más cercano que recorta o define un ancho) por más de 1 px, o
 * pasa el borde de la pantalla. Se ignoran los carruseles con
 * desplazamiento horizontal (su contenido se sale a propósito) y los
 * paneles internos de Leaflet.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DUENO = "demo-arepas-dona-rosa@ruteando.test";
const ANCHOS = [360, 390, 412];

async function entrar(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function crearConsumidor(): Promise<string> {
  const email = `e2e-desbordes-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Cliente Desbordes", email, password: PASSWORD, role: "consumer" }),
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

/** Elementos visibles que se salen de su contenedor o de la pantalla. */
async function desbordes(page: Page): Promise<string[]> {
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const ignorado = (el: Element) => {
      if (el.closest(".leaflet-pane, .leaflet-control-container")) return true;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    };
    const contenedor = (el: Element): Element | null => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (cs.display !== "contents" && cs.display !== "inline") return p;
        p = p.parentElement;
      }
      return null;
    };
    const nombre = (el: Element) =>
      `<${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40)}"`;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (ignorado(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1 || r.left < -1) {
        out.push(`${nombre(el)} se sale de la pantalla (${Math.round(r.left)}–${Math.round(r.right)} de ${vw})`);
        continue;
      }
      const p = contenedor(el);
      if (!p) continue;
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === "auto" || pcs.overflowX === "scroll") continue;
      const pr = p.getBoundingClientRect();
      const izq = pr.left + parseFloat(pcs.borderLeftWidth);
      const der = pr.right - parseFloat(pcs.borderRightWidth);
      if (r.right > der + 1 || r.left < izq - 1) {
        out.push(`${nombre(el)} se sale de ${nombre(p)} (${Math.round(r.left)}–${Math.round(r.right)} en ${Math.round(izq)}–${Math.round(der)})`);
      }
    }
    return [...new Set(out)];
  });
}

/** Controles de hojas/paneles que quedan debajo de un botón flotante. */
async function tapadosPorFlotantes(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const flot = [...document.querySelectorAll("[data-floating-action] a, [data-floating-action] button")].map((f) =>
      f.getBoundingClientRect(),
    );
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      if (flot.some((f) => r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top)) {
        out.push((el.getAttribute("aria-label") ?? el.innerText).trim().slice(0, 40));
      }
    }
    return out;
  }, selector);
}

for (const ancho of ANCHOS) {
  test.describe(`sin desbordes a ${ancho} px`, () => {
    test.use({
      viewport: { width: ancho, height: 800 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 4.6083, longitude: -74.2188 },
    });

    test("mapa y hoja de Buscar", async ({ page }) => {
      await entrar(page, await crearConsumidor());
      await page.goto("/mapa", { waitUntil: "networkidle" });
      expect(await desbordes(page)).toEqual([]);
      await page.getByRole("button", { name: "Buscar" }).click();
      await page.waitForTimeout(400);
      expect(await desbordes(page)).toEqual([]);
      // Nada de la hoja (cerrar, buscar, campos) debajo de los flotantes.
      expect(await tapadosPorFlotantes(page, "[data-search-sheet] button, [data-search-sheet] input, [data-search-sheet] select")).toEqual([]);
    });

    test("buscar y cuenta", async ({ page }) => {
      await entrar(page, await crearConsumidor());
      for (const ruta of ["/buscar", "/cuenta"]) {
        await page.goto(ruta, { waitUntil: "networkidle" });
        expect(await desbordes(page), ruta).toEqual([]);
      }
    });

    test("tablero, perfil del dueño y Ajustes con todas las familias abiertas", async ({ page }) => {
      await entrar(page, DUENO);
      await page.waitForURL("**/tablero");
      await page.waitForLoadState("networkidle");
      expect(await desbordes(page)).toEqual([]);
      await page.getByRole("link", { name: "Ver como cliente" }).click();
      await page.waitForURL(/\/negocios\/[0-9a-f-]+$/);
      await page.waitForLoadState("networkidle");
      expect(await desbordes(page)).toEqual([]);
      await page.goto(`${page.url()}/ajustes`, { waitUntil: "networkidle" });
      for (const f of ["Identidad", "Cómo comprar", "Ubicación", "Horario", "Confianza", "Herramientas"]) {
        await page.getByRole("button", { name: new RegExp(`^${f}`) }).click();
      }
      await page.waitForTimeout(1200);
      expect(await desbordes(page)).toEqual([]);
    });
  });
}
