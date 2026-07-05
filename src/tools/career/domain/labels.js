/**
 * Etiquetas flotantes del mapa 3D (MC-17): funciones PURAS, sin Three ni DOM.
 *
 * Dos problemas, dos piezas:
 *  1. Tamaño APARENTE constante: los sprites de etiqueta viven en unidades de
 *     mundo, así que de cerca son gigantes y de lejos ilegibles.
 *     `labelWorldScale` da la escala de mundo que hace que un sprite mida
 *     `targetPx` píxeles en pantalla a una distancia dada (con clamp contra
 *     extremos). `labelScreenPx` es la inversa (qué píxeles APARENTA una
 *     escala de mundo ya aplicada, útil tras el clamp).
 *  2. Declutter: dos etiquetas nunca deben pisarse. `declutterLabels` recibe
 *     las cajas proyectadas a pantalla y decide, por prioridad, cuáles se ven.
 *
 * Quien proyecta a pantalla y aplica visibilidad es <career-island-3d>; aquí
 * no hay ningún conocimiento de Three.js: todo es testeable en Vitest.
 *
 * @typedef {{ id: string, x: number, y: number, w: number, h: number,
 *   priority: number, dist?: number }} LabelBox
 *   Caja de una etiqueta proyectada a pantalla: `x`/`y` es el CENTRO en px
 *   (los sprites se anclan centrados), `w`/`h` su tamaño en px, `priority`
 *   su rango en la jerarquía (mayor gana) y `dist` la distancia a cámara
 *   (desempate: a igual prioridad gana la más cercana, que es la mayor en
 *   pantalla y la más relevante para quien mira).
 */

/**
 * Jerarquía de prioridad del declutter (mayor gana el hueco):
 * números de la ruta de reto (JG-5: el camino siempre se lee) > ciudad
 * seleccionada > ciudad actual del journey > comarcas y puerto (topónimos que
 * estructuran la vista general) > ciudades con visado disponible (las
 * accionables) > resto de ciudades > nombres de compañeros (rótulos
 * personales: nunca deben tapar un topónimo).
 *
 * Los números de la ruta LIBRE (JG-9) comparten rango con los del reto: nunca
 * conviven en pantalla (con reto activo la numeración libre se oculta — la
 * decisión vive en <career-app>), así que no compiten entre sí y ambos deben
 * leerse siempre por encima de cualquier nombre.
 */
export const LABEL_PRIORITY = Object.freeze({
  challenge: 6,
  route: 6,
  selected: 5,
  current: 4,
  area: 3,
  available: 2,
  city: 1,
  teammate: 1,
});

/** Margen (px) entre cajas: dos etiquetas a menos de este respiro colisionan. */
export const DECLUTTER_MARGIN_PX = 2;

/**
 * Escala de mundo (altura del sprite en unidades de mundo) para que mida
 * `targetPx` píxeles de alto en pantalla a la distancia frontal `dist`.
 *
 * Derivación: con una cámara en perspectiva de fov VERTICAL `fovRad`, el alto
 * visible del mundo a distancia d es `2·d·tan(fov/2)`, que se proyecta sobre
 * `viewportH` píxeles. No interviene el aspect: alto de mundo ↔ alto de
 * viewport (three usa fov vertical).
 *
 * El clamp evita extremos: `min` que el sprite no degenere al acercarse
 * mucho, `max` que en un zoom-out extremo las etiquetas no engullan la isla.
 *
 * @param {number} dist Distancia FRONTAL a la cámara (profundidad de vista, > 0).
 * @param {number} targetPx Alto objetivo del sprite en px de pantalla.
 * @param {number} fovRad Fov vertical de la cámara en radianes.
 * @param {number} viewportH Alto del viewport en px.
 * @param {{ min?: number, max?: number }} [clamp] Cotas de la escala de mundo.
 * @returns {number} Escala de mundo acotada.
 */
export function labelWorldScale(dist, targetPx, fovRad, viewportH, clamp = {}) {
  const { min = 0, max = Infinity } = clamp;
  if (!(dist > 0) || !(viewportH > 0)) return min;
  const world = (targetPx * 2 * dist * Math.tan(fovRad / 2)) / viewportH;
  return Math.min(Math.max(world, min), max);
}

/**
 * Inversa de labelWorldScale: píxeles de pantalla que APARENTA un sprite de
 * `worldScale` unidades de alto a distancia frontal `dist`. Se usa para medir
 * la caja real del declutter cuando el clamp ha tocado la escala.
 *
 * @param {number} worldScale Alto del sprite en unidades de mundo.
 * @param {number} dist Distancia frontal a la cámara (> 0).
 * @param {number} fovRad Fov vertical en radianes.
 * @param {number} viewportH Alto del viewport en px.
 * @returns {number} Alto aparente en px (0 si la distancia no es válida).
 */
export function labelScreenPx(worldScale, dist, fovRad, viewportH) {
  if (!(dist > 0)) return 0;
  return (worldScale * viewportH) / (2 * dist * Math.tan(fovRad / 2));
}

/**
 * ¿Colisionan dos cajas centradas, con el margen de respiro?
 * @param {LabelBox} a
 * @param {LabelBox} b
 * @returns {boolean}
 */
function boxesCollide(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + DECLUTTER_MARGIN_PX &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + DECLUTTER_MARGIN_PX
  );
}

/**
 * Declutter greedy y DETERMINISTA: recorre las etiquetas por prioridad
 * descendente (desempates: menor `dist` primero — la más cercana es la más
 * grande y relevante en pantalla — y después menor `id` lexicográfico, para
 * que el resultado no dependa del orden de llegada) y acepta cada una solo si
 * no colisiona (margen DECLUTTER_MARGIN_PX) con ninguna YA aceptada. Una
 * etiqueta rechazada no bloquea a las siguientes: si A tapa a B, una C que
 * solo chocaba con B sigue siendo visible.
 *
 * @param {LabelBox[]} items Cajas proyectadas a pantalla.
 * @returns {Set<string>} Ids de las etiquetas que deben verse.
 */
export function declutterLabels(items) {
  const order = items.toSorted(
    (a, b) =>
      b.priority - a.priority ||
      (a.dist ?? 0) - (b.dist ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  /** @type {LabelBox[]} */
  const placed = [];
  const visible = new Set();
  for (const item of order) {
    if (placed.some((p) => boxesCollide(p, item))) continue;
    placed.push(item);
    visible.add(item.id);
  }
  return visible;
}
