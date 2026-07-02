/**
 * Proyección isométrica 2.5D del Mapa de Carrera (funciones PURAS, sin DOM).
 *
 * Convierte las coordenadas lógicas del mapa (x, y en 0..100, con una z opcional
 * de altura para los pilares de las ciudades) a coordenadas de pantalla usando la
 * proyección isométrica estándar 2:1. El render (career-island) es quien consume
 * estas funciones; aquí no hay ningún conocimiento de SVG ni de Lit.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').City} City
 * @typedef {{ sx: number, sy: number }} ScreenPoint  Punto ya proyectado (px).
 * @typedef {{ tileW?: number, tileH?: number, zH?: number }} IsoOptions
 * @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} IsoBox
 */

/** Ancho del rombo (tile) isométrico base, en px proyectados. */
export const TILE_W = 24;
/** Alto del rombo isométrico base (ratio 2:1 clásico → TILE_H = TILE_W / 2). */
export const TILE_H = 12;
/** Altura en px que aporta una unidad de z (para los pilares 2.5D). */
export const Z_H = 10;

/**
 * Proyecta un punto lógico (x, y, z) del mapa al espacio isométrico de pantalla.
 *
 *   sx = (x - y) * tileW / 2
 *   sy = (x + y) * tileH / 2 - z * zH
 *
 * @param {number} x   Coordenada lógica 0..100.
 * @param {number} y   Coordenada lógica 0..100.
 * @param {number} [z] Altura lógica (0 = suelo); eleva el punto en pantalla.
 * @param {IsoOptions} [opts] Sobreescribe las constantes de tile/altura.
 * @returns {ScreenPoint} Punto proyectado en px.
 */
export function isoProject(x, y, z = 0, opts = {}) {
  const tileW = opts.tileW ?? TILE_W;
  const tileH = opts.tileH ?? TILE_H;
  const zH = opts.zH ?? Z_H;
  return {
    sx: (x - y) * (tileW / 2),
    sy: (x + y) * (tileH / 2) - z * zH,
  };
}

/**
 * Ordena las ciudades por profundidad para pintarlas de atrás hacia delante:
 * las de mayor (x + y) quedan "al frente" y por tanto se pintan al final, de modo
 * que el solapamiento 2.5D es correcto. Orden estable (no muta el array original).
 *
 * @param {City[]} cities
 * @returns {City[]} Copia ordenada por profundidad ascendente (fondo → frente).
 */
export function depthSort(cities) {
  return (cities ?? []).toSorted((a, b) => (a.x + a.y) - (b.x + b.y));
}

/**
 * Bounding box en espacio proyectado de un conjunto de puntos ya proyectados.
 * Útil para encuadrar la isla completa o hacer zoom a una comarca.
 *
 * @param {ScreenPoint[]} points Puntos { sx, sy } proyectados.
 * @returns {IsoBox|null} Caja envolvente, o null si no hay puntos.
 */
export function isoBounds(points) {
  const pts = points ?? [];
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.sx < minX) minX = p.sx;
    if (p.sx > maxX) maxX = p.sx;
    if (p.sy < minY) minY = p.sy;
    if (p.sy > maxY) maxY = p.sy;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Centro isométrico (proyectado) de una comarca: media de las posiciones de sus
 * ciudades a nivel de suelo (z = 0). Sirve para colocar etiquetas o centrar el zoom.
 *
 * @param {CareerMap} map
 * @param {string} areaId
 * @param {IsoOptions} [opts]
 * @returns {ScreenPoint|null} Centroide proyectado, o null si la comarca no tiene ciudades.
 */
export function areaCentroid(map, areaId, opts = {}) {
  const cities = (map?.cities ?? []).filter((c) => c.area === areaId);
  if (cities.length === 0) return null;
  const pts = cities.map((c) => isoProject(c.x, c.y, 0, opts));
  const sx = pts.reduce((s, p) => s + p.sx, 0) / pts.length;
  const sy = pts.reduce((s, p) => s + p.sy, 0) / pts.length;
  return { sx, sy };
}
