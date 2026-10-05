/**
 * Colores de marca de la instancia (RMR-TSK-0599): UN color por marca, que
 * tiene que llegar a WCAG AA en el tema claro y en el oscuro. Como ningún color
 * puede contrastar a la vez con blanco y con un fondo oscuro, la versión oscura
 * se CALCULA del mismo color (mismo tono, más claro). Puro.
 *
 * Umbrales: la marca es color de texto (4,5:1); acento y afectivo son
 * superficies, bordes y foco (3:1, el AA de lo que no es texto). El texto que va
 * encima del acento se elige solo: blanco o tinta, el que más contraste.
 */

export const LIGHT_SURFACE = '#ffffff';
export const DARK_SURFACE = '#1a202a';
const INK = '#10141a';

/** Los tres colores, su nombre visible y el mínimo que exigen. */
export const BRAND_SLOTS = Object.freeze([
  { key: 'brand', label: 'Marca (texto)', min: 4.5 },
  { key: 'accent', label: 'Acento', min: 3 },
  { key: 'affective', label: 'Afectivo', min: 3 },
]);

const HEX = /^#[0-9a-f]{6}$/i;

const channels = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);

/** Luminancia relativa WCAG. @param {string} hex */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b @returns {number} */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mezcla un color hacia el blanco en la proporción `t` (0 = igual, 1 = blanco). */
function towardWhite(hex, t) {
  const toHex = (c) => Math.round((c + (1 - c) * t) * 255).toString(16).padStart(2, '0');
  return `#${channels(hex).map(toHex).join('')}`;
}

/**
 * Versión del tema oscuro: el mismo color, aclarado lo justo para llegar a `min`
 * sobre la superficie oscura. Si ya llega, se queda como está.
 * @param {string} hex @param {number} min
 */
export function darkVariant(hex, min) {
  for (let t = 0; t <= 1; t += 0.02) {
    const candidate = towardWhite(hex, t);
    if (contrastRatio(candidate, DARK_SURFACE) >= min) return candidate;
  }
  return '#ffffff';
}

/** Texto sobre el acento: blanco o tinta, el que más contraste. @param {string} accent */
export function onAccentFor(accent) {
  return contrastRatio('#ffffff', accent) >= contrastRatio(INK, accent) ? '#ffffff' : INK;
}

const ratioText = (r) => r.toFixed(2).replace('.', ',');
const minText = (m) => String(m).replace('.', ',');

/**
 * Errores por los que NO se puede guardar, cada uno nombrando el par y su ratio.
 * Vacío = se puede guardar.
 * @param {{ brand?: string, accent?: string, affective?: string }} colors
 * @returns {string[]}
 */
export function validateBrandColors(colors) {
  const errors = [];
  for (const { key, label, min } of BRAND_SLOTS) {
    const hex = colors[key];
    if (typeof hex !== 'string' || !HEX.test(hex)) {
      errors.push(`${label.split(' ')[0]}: «${hex}» no es un color #rrggbb`);
      continue;
    }
    const light = contrastRatio(hex, LIGHT_SURFACE);
    if (light < min) errors.push(`${label} sobre fondo claro: ${ratioText(light)}:1 (mínimo ${minText(min)}:1)`);
    const dark = contrastRatio(darkVariant(hex, min), DARK_SURFACE);
    if (dark < min) errors.push(`${label} sobre fondo oscuro: ${ratioText(dark)}:1 (mínimo ${minText(min)}:1)`);
    if (key === 'accent') {
      const on = contrastRatio(onAccentFor(hex), hex);
      if (on < 4.5) errors.push(`Texto sobre el acento: ${ratioText(on)}:1 (mínimo 4,5:1)`);
    }
  }
  return errors;
}
