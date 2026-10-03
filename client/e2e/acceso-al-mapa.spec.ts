import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Regla del usuario (2026-10-03): desde cualquier pantalla con sesión,
 * volver al mapa está siempre a un toque y en el mismo lugar — el último
 * botón de la columna de navegación ("Ubicarme" en el mapa, "Mapa" fuera
 * de él).
 *
 * La prueba recorre TODAS las rutas de `src/app`: cada una tiene que estar
 * en RUTAS (se comprueba) o en SIN_COLUMNA (con su motivo). Una pantalla
 * nueva que no esté en ninguna de las dos hace fallar la prueba.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo`.
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const PASSWORD = "password123";
const DUENO = "demo-arepas-dona-rosa@ruteando.test";

type Cuenta = "consumidor" | "dueno" | "vendedorNuevo";

/** Ruta del archivo (como la arma Next) → cómo se visita. */
const RUTAS: Record<string, { cuenta: Cuenta; url: (ids: Ids) => string }[]> = {
  "/": [
    { cuenta: "consumidor", url: () => "/" },
    { cuenta: "vendedorNuevo", url: () => "/" },
  ],
  "/mapa": [{ cuenta: "consumidor", url: () => "/mapa" }],
  "/buscar": [{ cuenta: "consumidor", url: () => "/buscar" }],
  "/favoritos": [{ cuenta: "consumidor", url: () => "/favoritos" }],
  "/perfil": [
    { cuenta: "consumidor", url: () => "/perfil" },
    { cuenta: "dueno", url: () => "/perfil" },
    { cuenta: "vendedorNuevo", url: () => "/perfil" },
  ],
  "/cuenta": [
    { cuenta: "consumidor", url: () => "/cuenta" },
    { cuenta: "dueno", url: () => "/cuenta" },
  ],
  "/negocios/[businessId]": [
    { cuenta: "consumidor", url: (ids) => `/negocios/${ids.negocioDemo}` },
    { cuenta: "dueno", url: (ids) => `/negocios/${ids.negocioDelDueno}` },
  ],
  "/negocios/[businessId]/ajustes": [{ cuenta: "dueno", url: (ids) => `/negocios/${ids.negocioDelDueno}/ajustes` }],
  "/tablero": [{ cuenta: "dueno", url: () => "/tablero" }],
  "/negocios/nuevo": [{ cuenta: "vendedorNuevo", url: () => "/negocios/nuevo" }],
  "/legal/terminos-condiciones": [{ cuenta: "consumidor", url: () => "/legal/terminos-condiciones" }],
  "/legal/tratamiento-datos": [{ cuenta: "consumidor", url: () => "/legal/tratamiento-datos" }],
};

const SIN_COLUMNA: Record<string, string> = {
  "/login": "pantalla de entrada, sin sesión",
  "/register": "pantalla de entrada, sin sesión",
  "/recuperar-contrasena": "sin sesión",
  "/restablecer-contrasena": "sin sesión",
  "/admin": "panel de administrador: sesión aparte, sin mapa",
  "/admin/login": "panel de administrador",
  "/admin/dashboard": "panel de administrador",
};

interface Ids {
  negocioDemo: string;
  negocioDelDueno: string;
}

function rutasDeLaApp(): string[] {
  const raiz = path.join(__dirname, "..", "src", "app");
  const rutas: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completo);
      else if (entrada.name === "page.tsx") {
        const relativa = path.relative(raiz, dir).split(path.sep).filter((p) => !/^\(.*\)$/.test(p));
        rutas.push("/" + relativa.join("/"));
      }
    }
  };
  recorrer(raiz);
  return rutas.map((r) => (r === "/" ? "/" : r.replace(/\/$/, ""))).sort();
}

async function crearCuenta(role: "consumer" | "vendor"): Promise<string> {
  const email = `e2e-mapa-${role}-${Date.now()}-${Math.round(Math.random() * 1e6)}@ruteando.test`;
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Prueba Mapa", email, password: PASSWORD, role }),
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

/** Último botón de la columna: nombre y caja. */
async function botonDelMapa(page: Page) {
  const ultimo = page.locator("[data-floating-action] > button, [data-floating-action] > a").last();
  await expect(ultimo).toBeVisible({ timeout: 15_000 });
  return { nombre: await ultimo.getAttribute("aria-label"), caja: (await ultimo.boundingBox())! };
}

test.use({
  viewport: { width: 390, height: 800 },
  isMobile: true,
  hasTouch: true,
  permissions: ["geolocation"],
  geolocation: { latitude: 4.6083, longitude: -74.2188 },
});

test("todas las rutas de la app están clasificadas", () => {
  const sinClasificar = rutasDeLaApp().filter((r) => !(r in RUTAS) && !(r in SIN_COLUMNA));
  expect(sinClasificar, "Ruta nueva: agrégala a RUTAS (con columna) o a SIN_COLUMNA (con motivo)").toEqual([]);
});

test("con sesión, el mapa está a un toque y siempre en el mismo lugar", async ({ browser }) => {
  test.setTimeout(240_000);
  const demo = await fetch(`${API}/businesses?q=${encodeURIComponent("Perros El Parche")}&limit=5`).then((r) => r.json());
  const cuentas: Record<Cuenta, string> = {
    consumidor: await crearCuenta("consumer"),
    dueno: DUENO,
    vendedorNuevo: await crearCuenta("vendor"),
  };

  const sinMapa: string[] = [];
  let referencia: { x: number; y: number } | null = null;

  for (const cuenta of Object.keys(cuentas) as Cuenta[]) {
    const contexto = await browser.newContext({
      viewport: { width: 390, height: 800 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 4.6083, longitude: -74.2188 },
    });
    const page = await contexto.newPage();
    await entrar(page, cuentas[cuenta]);
    let negocioDelDueno = "";
    if (cuenta === "dueno") {
      const t = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: DUENO, password: PASSWORD }),
      }).then((r) => r.json());
      const propios = await fetch(`${API}/users/me/businesses/today`, {
        headers: { authorization: `Bearer ${t.accessToken}` },
      }).then((r) => r.json());
      negocioDelDueno = propios.data[0].id;
    }
    const ids: Ids = { negocioDemo: demo.data[0].id, negocioDelDueno };

    for (const [ruta, visitas] of Object.entries(RUTAS)) {
      for (const visita of visitas.filter((v) => v.cuenta === cuenta)) {
        await page.goto(visita.url(ids), { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        const etiqueta = `${ruta} (${cuenta}, ${new URL(page.url()).pathname})`;
        try {
          const { nombre, caja } = await botonDelMapa(page);
          if (nombre !== "Volver al mapa" && nombre !== "Mi ubicación") {
            sinMapa.push(`${etiqueta}: el último botón es "${nombre}"`);
            continue;
          }
          const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
          referencia ??= centro;
          if (Math.abs(centro.x - referencia.x) > 1 || Math.abs(centro.y - referencia.y) > 1) {
            sinMapa.push(`${etiqueta}: el botón del mapa está en otro lugar (${Math.round(centro.x)}, ${Math.round(centro.y)})`);
          }
        } catch {
          sinMapa.push(`${etiqueta}: sin botón para volver al mapa`);
        }
      }
    }
    await contexto.close();
  }

  expect(sinMapa).toEqual([]);
});
