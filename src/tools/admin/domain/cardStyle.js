/**
 * Aspecto de las tarjetas (RMR-TSK-0573). Lógica pura: ni Firestore ni DOM.
 *
 * Se puede destacar una tarjeta y darle un color. El color se elige de una
 * PALETA CERRADA, no con un selector libre: con color libre es cuestión de
 * tiempo que alguien deje texto gris sobre gris, o algo que se lee en claro y
 * no en oscuro. Cada estilo de la paleta ya está resuelto para los dos temas.
 *
 * Destacar y teñir son cosas distintas a propósito: se puede destacar una
 * tarjeta sin cambiarle el color, que es lo más frecuente —«mira esto ahora»—.
 *
 * Un estilo desconocido se descarta y la tarjeta sale normal. Lo contrario
 * dejaría una tarjeta con una clase que ningún CSS define: invisible o
 * ilegible, y sin nadie a quien preguntar por qué.
 */

/**
 * @typedef {Object} CardStyle
 * @property {string} label      cómo se llama en el editor
 * @property {string} className  clase que se le pone a la tarjeta
 * @property {string} hint       para qué sirve, en el editor
 * @property {boolean} [isDefault]
 */

/** @type {Record<string, CardStyle>} */
export const CARD_STYLES = {
  neutro: { label: 'Normal', className: 'cs-neutro', hint: 'Como el resto.', isDefault: true },
  acento: { label: 'Acento', className: 'cs-acento', hint: 'La herramienta de la casa.' },
  aviso: { label: 'Aviso', className: 'cs-aviso', hint: 'Algo que corre prisa.' },
  calma: { label: 'Calma', className: 'cs-calma', hint: 'Lectura y consulta.' },
};

/** Ids de la paleta, en el orden en que se ofrecen. */
export const STYLE_IDS = Object.keys(CARD_STYLES);

/** El estilo de una tarjeta sin nada guardado. */
const DEFAULT_STYLE = Object.freeze({ style: 'neutro', featured: false });

/**
 * Estilos guardados, saneados. Lo que no vale se descarta en vez de pintarse:
 * una configuración rota tiene que dejar las tarjetas como siempre.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, {style: string, featured: boolean}>}
 */
export function normalizeStyles(raw) {
  /** @type {Record<string, {style: string, featured: boolean}>} */
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const clave = typeof key === 'string' ? key.trim() : '';
    if (clave === '' || !value || typeof value !== 'object') continue;
    const style = typeof value.style === 'string' && value.style in CARD_STYLES ? value.style : 'neutro';
    const featured = value.featured === true;
    // Una entrada que no dice nada distinto del comportamiento normal no se
    // guarda: el documento solo contiene lo que de verdad es una decisión.
    if (style === 'neutro' && !featured) continue;
    out[clave] = { style, featured };
  }
  return out;
}

/**
 * Estilo efectivo de una tarjeta.
 * @param {Record<string, {style: string, featured: boolean}>|null|undefined} styles
 * @param {string} key
 */
export function styleOf(styles, key) {
  return styles?.[key] ?? { ...DEFAULT_STYLE };
}

/**
 * Clases que hay que ponerle a la tarjeta. Sin decisión, ninguna: no se ensucia
 * el marcado con clases que no hacen nada.
 * @param {{style: string, featured: boolean}} style
 * @returns {string[]}
 */
export function cardClasses(style) {
  const clases = [];
  const paleta = CARD_STYLES[style?.style];
  if (paleta && !paleta.isDefault) clases.push(paleta.className);
  if (style?.featured === true) clases.push('cs-featured');
  return clases;
}
