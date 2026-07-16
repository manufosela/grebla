/**
 * Formas de casa por comarca (RMR-TSK-0233). En el mapa de carrera cada casa se
 * dibuja con una forma según su comarca (no solo por color de estado), para que
 * se vea de un vistazo a qué comarca pertenece. La forma es DETERMINISTA por la
 * posición de la comarca en la isla: misma comarca → misma forma siempre.
 *
 * Puro (sin DOM, sin SVG): devuelve solo el `d` de un <path>. El render (career-map)
 * pinta <circle> para la forma base y <path class="dot"> para las demás, de modo
 * que el color por estado (CSS .node.X .dot) se aplica igual.
 */

/**
 * Repertorio de formas, en orden de asignación por comarca. `circle` es la base
 * (se dibuja con <circle>); el resto son siluetas de vivienda.
 * @type {ReadonlyArray<'circle'|'house'|'hut'|'tipi'|'leanto'>}
 */
export const HOUSE_SHAPES = /** @type {const} */ (['circle', 'house', 'hut', 'tipi', 'leanto']);

/** Etiqueta legible de cada forma (tooltips / leyenda). */
export const HOUSE_SHAPE_LABEL = {
  circle: 'círculo',
  house: 'casa',
  hut: 'choza',
  tipi: 'tipi',
  leanto: 'tejado a un agua',
};

/**
 * Forma que corresponde a una comarca, por su posición en `areas` (ciclada si
 * hay más comarcas que formas). Sin comarca o comarca desconocida → forma base.
 * @param {string|null|undefined} areaId
 * @param {ReadonlyArray<{ id: string }>} areas  comarcas de la isla, en orden
 * @returns {typeof HOUSE_SHAPES[number]}
 */
export function shapeForArea(areaId, areas) {
  if (!areaId || !Array.isArray(areas)) return HOUSE_SHAPES[0];
  const idx = areas.findIndex((a) => a?.id === areaId);
  if (idx < 0) return HOUSE_SHAPES[0];
  return HOUSE_SHAPES[idx % HOUSE_SHAPES.length];
}

/** Redondeo a 3 decimales para un path limpio y determinista. */
const n = (v) => Math.round(v * 1000) / 1000;

/**
 * `d` de un <path> con la silueta de la forma, centrada en (cx, cy) y de radio r
 * (caja ~2r×2r, tamaño visual parejo al círculo). Para `circle` devuelve '' (el
 * llamante usa <circle>). Forma desconocida → '' también.
 * @param {string} shape
 * @param {number} cx @param {number} cy @param {number} r
 * @returns {string}
 */
export function houseShapePath(shape, cx, cy, r) {
  const s = r;
  switch (shape) {
    // Casa: paredes + tejado a dos aguas.
    case 'house':
      return `M ${n(cx - s)} ${n(cy + s)} L ${n(cx - s)} ${n(cy - 0.15 * s)} L ${n(cx)} ${n(cy - s)} L ${n(cx + s)} ${n(cy - 0.15 * s)} L ${n(cx + s)} ${n(cy + s)} Z`;
    // Choza: base recta rematada por una cúpula (semicírculo).
    case 'hut':
      return `M ${n(cx - s)} ${n(cy + s)} L ${n(cx - s)} ${n(cy)} A ${n(s)} ${n(s)} 0 0 1 ${n(cx + s)} ${n(cy)} L ${n(cx + s)} ${n(cy + s)} Z`;
    // Tipi: triángulo (tienda cónica).
    case 'tipi':
      return `M ${n(cx)} ${n(cy - s)} L ${n(cx + 0.85 * s)} ${n(cy + s)} L ${n(cx - 0.85 * s)} ${n(cy + s)} Z`;
    // Tejado a un agua: cuadrilátero con la cubierta inclinada (mono-pendiente).
    case 'leanto':
      return `M ${n(cx - s)} ${n(cy + s)} L ${n(cx - s)} ${n(cy + 0.15 * s)} L ${n(cx + s)} ${n(cy - s)} L ${n(cx + s)} ${n(cy + s)} Z`;
    default:
      return '';
  }
}
