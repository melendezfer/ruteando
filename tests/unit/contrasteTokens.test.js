const fs = require('node:fs');
const path = require('node:path');

/**
 * A9 (fix/pulido-visual): contraste AA de los colores de la interfaz,
 * calculado por programa sobre los tokens REALES de
 * client/src/app/globals.css — nunca a mano. Fórmula de luminancia relativa
 * de WCAG 2.x; los tintes con transparencia (`bg-verde/10`) se mezclan
 * sobre el fondo real antes de medir.
 *
 * Umbrales: texto 4.5:1 (1.4.3); íconos y bordes que identifican un
 * control o un estado 3:1 (1.4.11). Al usar un color nuevo como texto o
 * ícono en la app, agregar aquí su par.
 */

const CSS = fs.readFileSync(path.join(__dirname, '../../client/src/app/globals.css'), 'utf8');
const ROOT = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('@theme inline'));

function token(nombre) {
  const m = ROOT.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`Token --color-${nombre} no encontrado en globals.css`);
  return m[1];
}

const rgb = (hex) => hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255);
const lineal = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminancia = (hex) => {
  const [r, g, b] = rgb(hex).map(lineal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Color `fg` con opacidad `a` pintado sobre `bg` (ej. bg-verde/10 sobre blanco). */
const mezcla = (fg, bg, a) =>
  `#${rgb(fg)
    .map((c, i) => Math.round((c * a + rgb(bg)[i] * (1 - a)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const T = (n) => token(n);
const BLANCO = '#ffffff';
const TEXTO = 4.5;
const GRAFICO = 3;

// [descripción, primer plano, fondo, mínimo]
const PARES = [
  ['texto sobre surface', () => T('text'), () => T('surface'), TEXTO],
  ['text-muted sobre surface', () => T('text-muted'), () => T('surface'), TEXTO],
  ['text-muted sobre background', () => T('text-muted'), () => T('background'), TEXTO],
  ['blanco sobre terracota (botón principal)', () => BLANCO, () => T('terracota'), TEXTO],
  ['blanco sobre terracota-dark', () => BLANCO, () => T('terracota-dark'), TEXTO],
  ['terracota sobre surface (texto y enlaces)', () => T('terracota'), () => T('surface'), TEXTO],
  ['terracota sobre terracota/10 (insignias)', () => T('terracota'), () => mezcla(T('terracota'), BLANCO, 0.1), TEXTO],
  ['verde sobre surface ("Disponible", "Vendiendo ahora")', () => T('verde'), () => T('surface'), TEXTO],
  ['verde-texto sobre verde/10 (higiene, confirmado)', () => T('verde-texto'), () => mezcla(T('verde'), BLANCO, 0.1), TEXTO],
  ['verde-texto sobre verde/15 (reseña aprobada)', () => T('verde-texto'), () => mezcla(T('verde'), BLANCO, 0.15), TEXTO],
  ['ícono verde sobre verde/10 (agradecimiento al calificar)', () => T('verde'), () => mezcla(T('verde'), BLANCO, 0.1), GRAFICO],
  ['blanco sobre verde ("Abierto ahora" de la portada)', () => BLANCO, () => T('verde'), TEXTO],
  ['rojo sobre surface (errores, eliminar)', () => T('rojo'), () => T('surface'), TEXTO],
  ['rojo sobre rojo/10 (avisos de error)', () => T('rojo'), () => mezcla(T('rojo'), BLANCO, 0.1), TEXTO],
  ['ambar-texto sobre ambar-suave ("Agotado", pendientes)', () => T('ambar-texto'), () => T('ambar-suave'), TEXTO],
  ['borde-control sobre surface (campos)', () => T('borde-control'), () => T('surface'), GRAFICO],
  ['borde-control sobre background (campos)', () => T('borde-control'), () => T('background'), GRAFICO],
  ['estrella marcada sobre surface (calificar)', () => T('estrella'), () => T('surface'), GRAFICO],
  ['estrella vacía sobre surface (calificar)', () => T('borde-control'), () => T('surface'), GRAFICO],
  ['ícono de oferta mostaza sobre mostaza/15', () => T('estrella'), () => mezcla(T('mostaza'), BLANCO, 0.15), GRAFICO],
];

describe('contraste AA de los tokens de color (globals.css)', () => {
  it.each(PARES)('%s', (_nombre, fg, bg, minimo) => {
    const valor = contraste(fg(), bg());
    expect(Number(valor.toFixed(2))).toBeGreaterThanOrEqual(minimo);
  });

  it('ningún componente usa ámbar sólido como texto (1.73:1 medido)', () => {
    const src = path.join(__dirname, '../../client/src');
    const archivos = [];
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(tsx|ts)$/.test(e.name)) archivos.push(p);
      }
    };
    recorrer(src);
    const culpables = archivos.filter((f) => /\btext-ambar(?![-\w])/.test(fs.readFileSync(f, 'utf8')));
    expect(culpables.map((f) => path.relative(src, f))).toEqual([]);
  });
});
