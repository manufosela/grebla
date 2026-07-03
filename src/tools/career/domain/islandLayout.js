/**
 * Layout 3D de la isla de carrera (funciones PURAS, sin Three ni DOM).
 *
 * Convierte el modelo lógico del mapa (x, y en 0..100) al espacio de mundo 3D
 * que consume <career-island-3d>: el plano del suelo es XZ (la y lógica del
 * mapa pasa a ser la z del mundo) y la altura es el eje Y. El mundo queda
 * centrado en el origen para que la cámara orbite alrededor de (0, 0, 0).
 *
 * También resuelve los colores por estado de ciudad (paleta --rm-* de GREBLA)
 * y la geometría lógica de comarcas e isla (centroides, radios). Aquí no hay
 * ningún conocimiento de Three.js ni de WebGL: todo es testeable en Vitest.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').Area} Area
 * @typedef {{ wx: number, wz: number }} WorldPoint  Punto de mundo en el plano XZ.
 * @typedef {{ size?: number }} WorldOptions
 * @typedef {{ area: Area, center: WorldPoint, radius: number, color: number }} AreaLayout
 */

/** Lado del mundo: el rango lógico 0..100 se proyecta a -WORLD_SIZE/2..WORLD_SIZE/2. */
export const WORLD_SIZE = 100;
/** Margen (unidades de mundo) alrededor de las ciudades de una comarca (su plataforma). */
export const AREA_PAD = 8;
/** Margen de playa: distancia extra entre la envolvente del contenido y el borde de la isla. */
export const BEACH_MARGIN = 12;
/** Radio mínimo de la isla (mapas vacíos o muy pequeños siguen siendo una isla visible). */
export const MIN_ISLAND_RADIUS = 20;

/**
 * Colores por estado de ciudad. Mapean la paleta CSS --rm-* del proyecto:
 *  - visited:    --rm-accent  #2a9d8f (teal GREBLA)
 *  - available:  --gr-coral   #f2887a
 *  - blocked:    --rm-track   #d7dee2 (gris de la leyenda)
 *  - deprecated: --rm-danger  #dc2626 atenuado al 50% sobre blanco → #ed9292
 *    (equivalente al `opacity: 0.5` que usa la vista 2.5D sobre fondo claro,
 *    pero horneado en el color para no depender de transparencias en 3D).
 */
export const STATUS_COLORS = Object.freeze({
  visited: 0x2a9d8f,
  available: 0xf2887a,
  blocked: 0xd7dee2,
  deprecated: 0xed9292,
});

/** Acentos overlay (no son estados): ciudad actual y ruta planificada. */
export const ACCENT_COLORS = Object.freeze({
  current: 0xe26d5e, // --rm-coral-600
  route: 0x1e3a5f, // --rm-navy
});

/**
 * Proyecta una coordenada lógica del mapa (0..100) al plano XZ del mundo,
 * centrado en el origen: 50 → 0, 0 → -size/2, 100 → +size/2.
 *
 * @param {number} x Coordenada lógica 0..100.
 * @param {number} y Coordenada lógica 0..100 (pasa a ser z del mundo).
 * @param {WorldOptions} [opts] size: lado del mundo (por defecto WORLD_SIZE).
 * @returns {WorldPoint}
 */
export function worldFromMap(x, y, opts = {}) {
  const size = opts.size ?? WORLD_SIZE;
  const scale = size / 100;
  return { wx: (x - 50) * scale, wz: (y - 50) * scale };
}

/**
 * Color (hex numérico para materiales 3D) de una ciudad según su estado.
 * Falla en alto si llega un estado desconocido: sin fallbacks silenciosos.
 *
 * @param {'visited'|'available'|'blocked'|'deprecated'} status
 * @returns {number}
 */
export function cityStatusColor(status) {
  const color = STATUS_COLORS[status];
  if (color === undefined) {
    throw new Error(`Estado de ciudad desconocido para el color 3D: "${status}"`);
  }
  return color;
}

/**
 * Convierte HSL a un color hex numérico (0xRRGGBB). Interno pero exportado
 * para poder testear el determinismo de los colores de comarca.
 *
 * @param {number} h Tono 0..360.
 * @param {number} s Saturación 0..100.
 * @param {number} l Luminosidad 0..100.
 * @returns {number}
 */
export function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to255 = (v) => Math.round(v * 255);
  return (to255(f(0)) << 16) | (to255(f(8)) << 8) | to255(f(4));
}

/**
 * Color suave y determinista para la plataforma de una comarca, repartiendo
 * el tono por índice (misma estrategia que la vista 2.5D: hue equiespaciado,
 * saturación y luminosidad fijas para que el terreno no compita con las ciudades).
 *
 * @param {number} index Índice de la comarca en map.areas.
 * @param {number} total Número total de comarcas.
 * @returns {number} Color hex numérico.
 */
export function areaColor(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return hslToHex(hue, 45, 82);
}

/**
 * Layout de las comarcas: para cada comarca CON ciudades, su centroide en
 * coordenadas de mundo, el radio que envuelve a sus ciudades (+ AREA_PAD) y
 * su color suave determinista. Las comarcas sin ciudades se omiten (no hay
 * nada que pintar debajo).
 *
 * @param {CareerMap} map
 * @param {WorldOptions} [opts]
 * @returns {AreaLayout[]}
 */
export function areaLayout(map, opts = {}) {
  const areas = map?.areas ?? [];
  const groups = Object.groupBy(map?.cities ?? [], (c) => c.area);
  return areas
    .map((area, i) => {
      const cities = groups[area.id] ?? [];
      if (cities.length === 0) return null;
      const pts = cities.map((c) => worldFromMap(c.x, c.y, opts));
      const cx = pts.reduce((s, p) => s + p.wx, 0) / pts.length;
      const cz = pts.reduce((s, p) => s + p.wz, 0) / pts.length;
      const spread = pts.reduce((m, p) => Math.max(m, Math.hypot(p.wx - cx, p.wz - cz)), 0);
      return {
        area,
        center: { wx: cx, wz: cz },
        radius: spread + AREA_PAD,
        color: areaColor(i, areas.length),
      };
    })
    .filter((a) => a !== null);
}

/**
 * Radio de la isla: envolvente (desde el origen del mundo) de todas las
 * ciudades y del puerto de inicio, más el margen de playa. Nunca menor que
 * MIN_ISLAND_RADIUS para que un mapa vacío siga siendo una isla visible.
 *
 * @param {CareerMap} map
 * @param {WorldOptions} [opts]
 * @returns {number}
 */
export function islandRadius(map, opts = {}) {
  const pts = (map?.cities ?? []).map((c) => worldFromMap(c.x, c.y, opts));
  if (map?.startPort) pts.push(worldFromMap(map.startPort.x, map.startPort.y, opts));
  const reach = pts.reduce((m, p) => Math.max(m, Math.hypot(p.wx, p.wz)), 0);
  return Math.max(reach + BEACH_MARGIN, MIN_ISLAND_RADIUS);
}
