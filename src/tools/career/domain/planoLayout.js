/**
 * Layout del PLANO del archipiélago (JG-11) — funciones PURAS, sin Lit ni DOM.
 *
 * El plano es una carta náutica: un CÍRCULO grande por isla (posicionado con
 * las x,y del índice /careerMap/_archipelago) y un círculo pequeño por TEMA
 * (casa) dentro del círculo de su isla. Aquí vive toda la geometría testeable
 * en Vitest: normalización de posiciones al viewBox, radios acotados,
 * resolución determinista de solapes, proyección de los temas al interior de
 * su círculo (con clamp radial) y la polilínea de una ruta (reto o ruta libre)
 * con fallback al centro de la isla cuando su mapa aún no está cargado.
 *
 * @typedef {import('./types.js').IslandRef} IslandRef
 * @typedef {import('./types.js').City} City
 * @typedef {{ id: string, name: string, cx: number, cy: number, r: number }} IslandCircle
 * @typedef {{ id: string, x: number, y: number }} ThemeSpot
 * @typedef {{ cityId: string, x: number, y: number, resolved: boolean }} RoutePoint
 */

/** Lado del viewBox del plano (el SVG usa viewBox="0 0 100 100"). */
export const PLANO_VIEW = 100;
/** Margen del plano: separación mínima entre un círculo de isla y el borde. */
export const PLANO_MARGIN = 4;
/** Banda reservada BAJO cada círculo para su nombre (gap + fuente + descendentes). */
export const LABEL_BAND = 4;
/** Separación vertical entre el borde del círculo y la línea base del nombre. */
export const LABEL_GAP = 3;
/** Ancho estimado por carácter del nombre (fuente ~3px bold del plano). */
export const LABEL_CHAR_W = 1.9;
/** Radio mínimo de un círculo de isla (islas vacías siguen siendo visibles). */
export const ISLAND_R_MIN = 6;
/** Radio máximo de un círculo de isla (13 islas deben caber sin ahogarse). */
export const ISLAND_R_MAX = 11;
/** Factor del radio: r = K·sqrt(citiesTotal), acotado a [R_MIN, R_MAX]. */
export const ISLAND_R_K = 1.9;
/** Holgura mínima entre círculos de isla al resolver solapes. */
export const ISLAND_GAP = 1.5;
/** Pasadas máximas de la relajación de solapes (converge mucho antes). */
const OVERLAP_PASSES = 40;
/** Ángulo áureo (rad) para separar círculos EXACTAMENTE coincidentes. */
const GOLDEN_ANGLE = 2.399963229728653;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Separa un par de círculos solapados empujándolos a partes iguales por la
 * línea que une sus centros; si coinciden exactamente, la dirección la da el
 * ángulo áureo del índice del par (determinista). Devuelve si hubo empuje.
 * @param {IslandCircle} a
 * @param {IslandCircle} b
 * @param {number} pairIndex
 * @param {number} gap
 * @returns {boolean}
 */
function separatePair(a, b, pairIndex, gap) {
  const need = a.r + b.r + gap;
  const d = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  if (d >= need) return false;
  const angle = d === 0 ? pairIndex * GOLDEN_ANGLE : Math.atan2(b.cy - a.cy, b.cx - a.cx);
  const push = (need - d) / 2;
  a.cx -= Math.cos(angle) * push;
  a.cy -= Math.sin(angle) * push;
  b.cx += Math.cos(angle) * push;
  b.cy += Math.sin(angle) * push;
  return true;
}

/**
 * Radio de una isla en el plano: proporcional a sqrt(citiesTotal) — el ÁREA
 * crece con el nº de temas — y acotado para que las 13 islas quepan.
 * @param {number} citiesTotal
 * @param {{ rMin?: number, rMax?: number, k?: number }} [opts]
 * @returns {number}
 */
const islandRadius = (citiesTotal, { rMin = ISLAND_R_MIN, rMax = ISLAND_R_MAX, k = ISLAND_R_K } = {}) =>
  clamp(k * Math.sqrt(Math.max(Number(citiesTotal) || 0, 0)), rMin, rMax);

/**
 * Círculos de isla del plano: normaliza las posiciones x,y del índice del
 * archipiélago (rango arbitrario, nominal 0..100) al viewBox con margen,
 * asigna radios acotados y separa DETERMINISTA los solapes (relajación por
 * pares: cada par solapado se empuja a partes iguales por la línea que une
 * sus centros; los coincidentes exactos se abren por el ángulo áureo del
 * índice del par — sin aleatoriedad, misma entrada → mismo layout). El borde
 * inferior reserva además la banda de la etiqueta (labelBand): el nombre se
 * pinta BAJO el círculo y también debe caber en el viewBox (RMR-BUG-0014).
 * @param {ReadonlyArray<IslandRef>|null|undefined} islands
 * @param {{ view?: number, margin?: number, rMin?: number, rMax?: number, k?: number, gap?: number, labelBand?: number }} [opts]
 * @returns {IslandCircle[]}
 */
export function islandCircles(islands, opts = {}) {
  const { view = PLANO_VIEW, margin = PLANO_MARGIN, gap = ISLAND_GAP, labelBand = LABEL_BAND } = opts;
  const list = (islands ?? []).filter((isle) => isle && typeof isle.id === 'string');
  if (list.length === 0) return [];

  const radii = list.map((isle) => islandRadius(isle.citiesTotal, opts));
  const pad = margin + Math.max(...radii);
  const xs = list.map((isle) => Number(isle.x) || 0);
  const ys = list.map((isle) => Number(isle.y) || 0);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const norm = (value, min, span, lo, hi) =>
    span === 0 ? (lo + hi) / 2 : lo + ((value - min) / span) * (hi - lo);

  const circles = list.map((isle, i) => ({
    id: isle.id,
    name: isle.name ?? isle.id,
    cx: norm(xs[i], Math.min(...xs), spanX, pad, view - pad),
    cy: norm(ys[i], Math.min(...ys), spanY, pad, view - pad - labelBand),
    r: radii[i],
  }));

  // Relajación de solapes: empuja cada par solapado hasta que ninguno se toca
  // (o se agotan las pasadas: con el clamp al viewBox puede no caber todo).
  // El clamp vertical respeta la banda de la etiqueta: ningún empuje puede
  // dejar un círculo cuyo nombre quede fuera del lienzo por abajo.
  for (let pass = 0; pass < OVERLAP_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        const pairIndex = i * circles.length + j;
        if (separatePair(circles[i], circles[j], pairIndex, gap)) moved = true;
      }
    }
    for (const c of circles) {
      c.cx = clamp(c.cx, c.r, view - c.r);
      c.cy = clamp(c.cy, c.r, view - c.r - labelBand);
    }
    if (!moved) break;
  }
  return circles;
}

/**
 * Posición de la ETIQUETA (nombre) de un círculo de isla: centrada bajo el
 * círculo, pero con la X clampada para que el texto ESTIMADO (chars × charW)
 * no se salga del viewBox por los lados — el nombre puede ser bastante más
 * ancho que su círculo («Engineering Manager» pegado al borde izquierdo).
 * La Y cabe siempre gracias a la banda que reserva islandCircles; aun así se
 * acota por si el círculo viene de otra fuente (modo single, datos legacy).
 * @param {IslandCircle} circle
 * @param {{ view?: number, gap?: number, charW?: number }} [opts]
 * @returns {{ x: number, y: number, halfWidth: number }}
 */
export function islandLabel(circle, { view = PLANO_VIEW, gap = LABEL_GAP, charW = LABEL_CHAR_W } = {}) {
  const name = String(circle.name ?? '');
  const halfWidth = Math.min((name.length * charW) / 2, view / 2);
  return {
    x: clamp(circle.cx, halfWidth, view - halfWidth),
    y: Math.min(circle.cy + circle.r + gap, view - 1),
    halfWidth,
  };
}

/**
 * Posición de cada TEMA (casa) dentro del círculo de su isla: proyección
 * lineal de las x,y lógicas del mapa (0..100, centro en 50,50) al radio
 * interior del círculo, más CLAMP radial — las esquinas del mapa cuadrado
 * exceden el círculo y se retraen a su borde interior: ningún tema se sale.
 * @param {IslandCircle} circle
 * @param {ReadonlyArray<Pick<City, 'id'|'x'|'y'>>|null|undefined} cities
 * @param {{ margin?: number }} [opts] margin: orla libre junto al borde.
 * @returns {ThemeSpot[]}
 */
export function themeSpots(circle, cities, opts = {}) {
  const margin = opts.margin ?? Math.max(1, circle.r * 0.16);
  const inner = Math.max(circle.r - margin, 0.5);
  return (cities ?? []).map((city) => {
    let x = circle.cx + (((Number(city.x) || 0) - 50) / 50) * inner;
    let y = circle.cy + (((Number(city.y) || 0) - 50) / 50) * inner;
    const d = Math.hypot(x - circle.cx, y - circle.cy);
    if (d > inner) {
      x = circle.cx + ((x - circle.cx) / d) * inner;
      y = circle.cy + ((y - circle.cy) / d) * inner;
    }
    return { id: city.id, x, y };
  });
}

/**
 * Índice prefijo→isla para resolver la isla de un cityId ("bases/git" →
 * "island"): los ids de ciudad llevan la DISCIPLINA como prefijo, que solo
 * coincide con el id del doc de isla en las islas nuevas (la de inicio es
 * id "island" / disciplina "bases"). Indexa por ambos.
 * @param {ReadonlyArray<IslandRef>|null|undefined} islands
 * @returns {Map<string, string>}
 */
export function prefixIslandIndex(islands) {
  const index = new Map();
  for (const isle of islands ?? []) {
    if (!isle?.id) continue;
    index.set(isle.id, isle.id);
    if (isle.discipline) index.set(isle.discipline, isle.id);
  }
  return index;
}

/**
 * Puntos de la polilínea de una ruta (reto o ruta libre) sobre el plano, en
 * el orden de las paradas. Cada parada resuelve a su TEMA si el mapa de su
 * isla ya está cargado (`spotsById`); si no, cae al CENTRO del círculo de su
 * isla (`resolved: false` — la línea se refina cuando el mapa llega). Una
 * parada cuya isla no existe en el plano va a `missing`: nada de inventar
 * posiciones en silencio.
 * @param {ReadonlyArray<string>|null|undefined} stops cityIds en orden.
 * @param {Map<string, ThemeSpot>|null|undefined} spotsById
 * @param {Map<string, IslandCircle>|null|undefined} circlesById
 * @param {{ islandIdByPrefix?: Map<string, string> }} [opts]
 * @returns {{ points: RoutePoint[], missing: string[] }}
 */
export function routePolyline(stops, spotsById, circlesById, opts = {}) {
  /** @type {RoutePoint[]} */
  const points = [];
  /** @type {string[]} */
  const missing = [];
  for (const cityId of stops ?? []) {
    const spot = spotsById?.get(cityId);
    if (spot) {
      points.push({ cityId, x: spot.x, y: spot.y, resolved: true });
      continue;
    }
    const slash = cityId.indexOf('/');
    const prefix = slash === -1 ? cityId : cityId.slice(0, slash);
    const islandId = opts.islandIdByPrefix?.get(prefix) ?? prefix;
    const circle = circlesById?.get(islandId);
    if (circle) {
      points.push({ cityId, x: circle.cx, y: circle.cy, resolved: false });
      continue;
    }
    missing.push(cityId);
  }
  return { points, missing };
}

/**
 * Zoom de una isla expandida: escala que encuadra su círculo (más el margen
 * del plano de padding) en el viewBox completo. Nunca reduce por debajo de 1.
 * El componente compone con ella el transform CSS
 * `translate(50,50) scale(k) translate(-cx,-cy)`.
 * @param {IslandCircle} circle
 * @param {{ view?: number, pad?: number }} [opts]
 * @returns {{ scale: number }}
 */
export function islandZoom(circle, { view = PLANO_VIEW, pad = PLANO_MARGIN } = {}) {
  return { scale: Math.max(view / (2 * (circle.r + pad)), 1) };
}
