/**
 * Paleta de acento por juego (colores FIJOS → contraste AA garantizado en claro y
 * oscuro, sin depender del tema). Compartida por las vistas de Motivadores.
 */
const PALETTES = {
  teal: { '--accent': '#2a9d8f', '--accent-ink': '#14544c', '--accent-soft': '#d7efec', '--accent-on': '#ffffff' },
  coral: { '--accent': '#e26d5e', '--accent-ink': '#7a3227', '--accent-soft': '#fbe3df', '--accent-on': '#ffffff' },
};

/** @param {string} accent @returns {string} Cadena `--accent:…;…` para el atributo style. */
export function accentStyle(accent) {
  const p = accent === 'coral' ? PALETTES.coral : PALETTES.teal;
  return Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';');
}
