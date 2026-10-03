import { expect, test, type Page } from "@playwright/test";

/**
 * El crédito de OpenStreetMap ("Leaflet | © OpenStreetMap") tiene que verse
 * completo en el mapa, en cualquier celular: lo exige la licencia de los
 * datos de OSM (ODbL). Antes vivía abajo a la derecha y en pantallas chicas
 * lo pisaban el círculo grande de la navegación flotante y el logo
 * "Ruteando" (medido en iPhone SE y Pixel 7). Ahora vive arriba a la
 * derecha — esta prueba falla si cualquier cosa vuelve a taparlo.
 *
 * Cómo decide "tapado": recorre el recuadro del crédito en una grilla
 * densa (cada 3 px, en tres alturas) y pregunta al navegador qué elemento está
 * encima en cada uno (`document.elementFromPoint`). Si en alguno el
 * elemento de más arriba no es el propio crédito, está tapado. Límite
 * conocido: un elemento con `pointer-events: none` no cuenta para
 * `elementFromPoint`, así que una capa así no se detectaría.
 *
 * Requisitos: backend + frontend corriendo y `npm run seed:demo` (la cuenta
 * y la zona de la prueba salen de esos datos de demo).
 */

const EMAIL = process.env.E2E_EMAIL ?? "demo-perros-el-parche@ruteando.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "password123";

// Centro de Ciudad Verde (scripts/seedDemoBusinesses.js, sección 25).
const CENTRO = { latitude: 4.6083, longitude: -74.2188 };
// Zona "este" de los datos de demo (~350 m al oriente, junto a Perros El
// Parche): desde ahí aparece la tarjeta de comparación de zonas (sección 32).
const ZONA_ESTE = { latitude: 4.6083, longitude: -74.21564 };

const PANTALLAS = [
  { nombre: "iPhone SE", width: 320, height: 568 },
  { nombre: "Android chico", width: 360, height: 640 },
  { nombre: "iPhone 8", width: 375, height: 667 },
  { nombre: "Pixel 7", width: 412, height: 839 },
];

async function entrarAlMapa(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(/correo/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar/i }).click();
  // Esperar a que la sesión exista antes de cambiar de ruta (el login
  // redirige solo; /mapa sin sesión muestra "inicia sesión").
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.goto("/mapa", { waitUntil: "networkidle" });
  await expect(page.locator(".leaflet-control-attribution")).toBeVisible();
}

async function expectCreditoVisible(page: Page, estado: string) {
  const credito = page.locator(".leaflet-control-attribution");
  await expect(credito, `${estado}: el crédito debe existir`).toBeVisible();
  await expect(credito).toContainText("OpenStreetMap");

  const caja = await credito.boundingBox();
  expect(caja, `${estado}: sin recuadro del crédito`).not.toBeNull();
  const { x, y, width, height } = caja!;
  const viewport = page.viewportSize()!;

  // Completo dentro de la pantalla (no cortado por un borde).
  expect(x, `${estado}: cortado por la izquierda`).toBeGreaterThanOrEqual(0);
  expect(y, `${estado}: cortado por arriba`).toBeGreaterThanOrEqual(0);
  expect(x + width, `${estado}: cortado por la derecha`).toBeLessThanOrEqual(viewport.width);
  expect(y + height, `${estado}: cortado por abajo`).toBeLessThanOrEqual(viewport.height);

  // Una grilla densa, no un puñado de puntos: el círculo de la navegación
  // puede pisar solo un tramo del texto (así pasaba antes del arreglo, y
  // con 7 puntos sueltos la prueba no lo veía). Cada 3 px a lo ancho, en
  // tres alturas; margen de 1 px porque los bordes exactos pueden caer en
  // el vecino por redondeo.
  const m = 1;
  const puntos: { nombre: string; px: number; py: number }[] = [];
  for (const [fila, py] of [
    ["arriba", y + m],
    ["medio", y + height / 2],
    ["abajo", y + height - m],
  ] as const) {
    for (let px = x + m; px <= x + width - m; px += 3) {
      puntos.push({ nombre: `${fila} x=${Math.round(px)}`, px, py });
    }
  }

  const encima = await page.evaluate(
    (lista) =>
      lista.map(({ nombre, px, py }) => {
        const el = document.elementFromPoint(px, py);
        const ok = Boolean(el?.closest(".leaflet-control-attribution"));
        return { nombre, ok, tapadoPor: ok ? null : (el?.outerHTML.slice(0, 120) ?? "nada") };
      }),
    puntos,
  );

  // Un resumen corto por elemento que tapa (no cientos de puntos iguales).
  const tapados = [...new Set(encima.filter((p) => !p.ok).map((p) => `${p.nombre}: ${p.tapadoPor}`))].slice(0, 5);
  expect(tapados, `${estado}: algo tapa el crédito de OpenStreetMap`).toEqual([]);
}

for (const pantalla of PANTALLAS) {
  test.describe(`crédito de OpenStreetMap — ${pantalla.nombre} (${pantalla.width}×${pantalla.height})`, () => {
    test.use({
      viewport: { width: pantalla.width, height: pantalla.height },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: CENTRO,
    });

    test("se ve completo en el mapa y con cada hoja abierta", async ({ page }) => {
      await entrarAlMapa(page);
      await expectCreditoVisible(page, "mapa sin hojas");

      // Hoja de búsqueda (botón "Buscar" de la navegación flotante).
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await expect(page.getByRole("button", { name: "Cerrar búsqueda" })).toBeVisible();
      await expectCreditoVisible(page, "hoja de búsqueda abierta");
      await page.getByRole("button", { name: "Cerrar búsqueda" }).click();

      // Lista filtrada ("Ver todas" del carrusel "Disponibles ahora").
      await page.getByRole("button", { name: "Ver todas: Disponibles ahora" }).click();
      await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();
      await expectCreditoVisible(page, "lista filtrada abierta");
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();

      // Resumen de un negocio (tocar una tarjeta del carrusel).
      await page.getByRole("button", { name: /^Ver detalle de / }).first().click();
      await expect(page.getByRole("button", { name: "Cerrar resumen del negocio" })).toBeVisible();
      await expectCreditoVisible(page, "resumen de negocio abierto");
    });

    test("se ve completo con la tarjeta de comparación de zonas", async ({ page, context }) => {
      await context.setGeolocation(ZONA_ESTE);
      await entrarAlMapa(page);
      await expect(
        page.getByRole("button", { name: /Ver esa zona/ }),
        "la tarjeta de zonas debería aparecer desde la zona este de los datos de demo (npm run seed:demo)",
      ).toBeVisible({ timeout: 15_000 });
      await expectCreditoVisible(page, "tarjeta de zonas visible");
    });
  });
}
