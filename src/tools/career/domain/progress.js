/**
 * Cálculo de progreso del Mapa de Carrera (funciones puras).
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 */

/** Puntos acumulados = suma de pesos de las ciudades visitadas (las deprecadas no puntúan). */
export function mapPoints(map, visited) {
  const ids = new Set(visited ?? []);
  return (map?.cities ?? [])
    .filter((c) => ids.has(c.id) && !c.deprecated)
    .reduce((s, c) => s + (c.weight || 0), 0);
}

/** Puntos máximos del mapa (las ciudades deprecadas no cuentan). */
export function totalPoints(map) {
  return (map?.cities ?? [])
    .filter((c) => !c.deprecated)
    .reduce((s, c) => s + (c.weight || 0), 0);
}

/** Progreso 0..100 (%). */
export function progressPct(map, visited) {
  const total = totalPoints(map);
  return total > 0 ? Math.round((mapPoints(map, visited) / total) * 100) : 0;
}

/**
 * Una ciudad es alcanzable si todos sus prerequisitos están visitados. Las
 * ciudades deprecadas nunca son alcanzables (no se pueden visitar).
 */
export function isReachable(map, cityId, visited) {
  const city = (map?.cities ?? []).find((c) => c.id === cityId);
  if (!city || city.deprecated) return false;
  const v = new Set(visited ?? []);
  if (v.has(cityId)) return true;
  return (city.prereqs ?? []).every((p) => v.has(p));
}

/** ids de ciudades NO visitadas, no deprecadas y alcanzables (siguiente paso posible). */
export function reachableCityIds(map, visited) {
  const v = new Set(visited ?? []);
  return (map?.cities ?? [])
    .filter((c) => !c.deprecated && !v.has(c.id) && (c.prereqs ?? []).every((p) => v.has(p)))
    .map((c) => c.id);
}

/**
 * Estado de una ciudad para una persona (única fuente de verdad para la UI):
 *  - 'deprecated': en desuso, no visitable.
 *  - 'visited': ya recorrida.
 *  - 'available': no visitada pero alcanzable (prerequisitos cumplidos).
 *  - 'blocked': no visitada y con prerequisitos pendientes.
 *  - 'unknown': la ciudad no existe en el mapa.
 * La "ciudad actual" (journey.currentCity) es un overlay, no un estado de color.
 * @param {CareerMap} map @param {string} cityId @param {{visitedCities?: string[]}} journey
 * @returns {'deprecated'|'visited'|'available'|'blocked'|'unknown'}
 */
export function cityStatus(map, cityId, journey) {
  const city = (map?.cities ?? []).find((c) => c.id === cityId);
  if (!city) return 'unknown';
  if (city.deprecated) return 'deprecated';
  const visited = journey?.visitedCities ?? [];
  if (visited.includes(cityId)) return 'visited';
  return isReachable(map, cityId, visited) ? 'available' : 'blocked';
}

/**
 * Prerequisitos PENDIENTES de una ciudad: ids de prereqs aún no visitados.
 * Es la explicación del estado 'blocked' para el panel de ciudadanía (MC-6).
 * Ciudad desconocida → [] (no hay nada que explicar).
 * @param {CareerMap} map @param {string} cityId @param {string[]} visited
 * @returns {string[]}
 */
export function missingPrereqs(map, cityId, visited) {
  const city = (map?.cities ?? []).find((c) => c.id === cityId);
  if (!city) return [];
  const v = new Set(visited ?? []);
  return (city.prereqs ?? []).filter((p) => !v.has(p));
}

/** Niveles de viaje por porcentaje de progreso (gamificación, no es la escala GREBLA). */
export const TRAVEL_LEVELS = [
  { min: 0, name: 'Aprendiz' },
  { min: 25, name: 'Explorador' },
  { min: 50, name: 'Viajero' },
  { min: 75, name: 'Veterano' },
  { min: 100, name: 'Leyenda' },
];

/** @param {number} pct */
export function levelFor(pct) {
  let level = TRAVEL_LEVELS[0];
  for (const l of TRAVEL_LEVELS) if (pct >= l.min) level = l;
  return level.name;
}
