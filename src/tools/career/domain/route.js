/**
 * Ruta LIBRE planificada (JG-9): lógica PURA sobre `journey.plannedRoute`.
 *
 * La ruta libre es la lista ORDENADA de casas que el jugador planifica en modo
 * Libre (ids de ciudad, sin duplicados). Aquí vive todo lo calculable sin
 * Firestore ni DOM: insertar/mover una parada en una posición elegida, la
 * numeración GLOBAL de la ruta (los badges ámbar de la isla), la resolución de
 * paradas a nombres/islas y el modelo del mapa del mar (qué islas toca la ruta
 * y en qué orden). Todo testeable en Vitest.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 */

/**
 * Inserta una casa en la posición `index` de la ruta (0-based), o la MUEVE si
 * ya estaba: la ruta nunca lleva duplicados — «añadir antes de X» una casa que
 * ya era parada equivale a recolocarla. Índice fuera de rango se ACOTA a los
 * extremos (documentado: subir la primera parada la deja primera, no falla);
 * sin índice (undefined) la casa va AL FINAL — el «por defecto» del selector.
 * Un índice no entero o una casa sin id fallan en alto.
 * @param {ReadonlyArray<string>|null|undefined} route Ruta actual (no se muta).
 * @param {string} cityId Casa a insertar o recolocar.
 * @param {number} [index] Posición destino (0-based); al final si se omite.
 * @returns {string[]} La ruta nueva.
 */
export function insertRouteAt(route, cityId, index) {
  const id = typeof cityId === 'string' ? cityId.trim() : '';
  if (!id) throw new Error('La ruta requiere el id de la casa a insertar.');
  if (index !== undefined && !Number.isInteger(index)) {
    throw new Error(`Posición de ruta inválida: "${index}"`);
  }
  const base = (route ?? []).filter((stop) => stop !== id);
  const at = index === undefined ? base.length : Math.min(Math.max(index, 0), base.length);
  return base.toSpliced(at, 0, id);
}

/**
 * Número de parada GLOBAL (1-based) por casa de la ruta libre — el hermano de
 * `stopNumberByCity` del modo Reto (JG-5), aquí sobre la plannedRoute completa
 * del archipiélago: la casa 4 de la ruta es la 4 aunque su isla solo tenga
 * dos paradas. Sin ruta → mapa vacío.
 * @param {ReadonlyArray<string>|null|undefined} plannedRoute
 * @returns {Map<string, number>}
 */
export function routeNumberByCity(plannedRoute) {
  return new Map((plannedRoute ?? []).map((id, index) => [id, index + 1]));
}

/**
 * Una parada de la ruta libre RESUELTA contra los mapas del archipiélago.
 * @typedef {Object} RouteStop
 * @property {number} n         Número global de la parada (1-based).
 * @property {string} cityId
 * @property {string} cityName
 * @property {string} islandId
 * @property {string} islandName
 */

/**
 * Resuelve la ruta planificada a paradas con nombre e isla usando los mapas ya
 * cargados. Las casas que no aparezcan en ningún mapa van a `missing` con su
 * número para que la UI lo cuente — nada de inventar nombres ni omitir en
 * silencio. La numeración es la GLOBAL de la ruta (missing incluidas: los
 * números de la isla y del gestor coinciden siempre).
 * @param {ReadonlyArray<string>|null|undefined} plannedRoute
 * @param {ReadonlyArray<CareerMap>} maps Mapas de isla ya cargados.
 * @returns {{ stops: RouteStop[], missing: { n: number, cityId: string }[] }}
 */
export function resolveRouteStops(plannedRoute, maps) {
  /** @type {RouteStop[]} */
  const stops = [];
  /** @type {{ n: number, cityId: string }[]} */
  const missing = [];
  for (const [index, cityId] of (plannedRoute ?? []).entries()) {
    const n = index + 1;
    const map = (maps ?? []).find((m) => (m.cities ?? []).some((c) => c.id === cityId));
    if (!map) {
      missing.push({ n, cityId });
      continue;
    }
    const city = map.cities.find((c) => c.id === cityId);
    stops.push({ n, cityId, cityName: city?.name ?? cityId, islandId: map.id, islandName: map.name });
  }
  return { stops, missing };
}

/**
 * Modelo de la ruta libre para el MAPA DEL MAR (JG-9): las islas que toca la
 * ruta EN EL ORDEN del viaje (deduplicadas solo entre paradas consecutivas:
 * [A, A, B, A] → A → B → A, la vuelta a A es un tramo real) y los números de
 * parada agregados por isla (la etiqueta «🧭 Tu ruta (paradas i–j)»).
 * @param {ReadonlyArray<RouteStop>} stops Paradas resueltas (resolveRouteStops).
 * @returns {{ hops: string[], byIsland: Map<string, number[]> }}
 */
export function routeSeaModel(stops) {
  /** @type {string[]} */
  const hops = [];
  /** @type {Map<string, number[]>} */
  const byIsland = new Map();
  for (const stop of stops ?? []) {
    if (hops.at(-1) !== stop.islandId) hops.push(stop.islandId);
    const numbers = byIsland.get(stop.islandId) ?? [];
    numbers.push(stop.n);
    byIsland.set(stop.islandId, numbers);
  }
  return { hops, byIsland };
}

/**
 * Etiqueta compacta de números de parada: consecutivos colapsan en rango con
 * guion «1–3» y los sueltos se listan «1–3, 5». Espera números ya ordenados
 * ascendentes (los de routeSeaModel lo están: siguen el orden de la ruta y por
 * isla son crecientes). Sin números → cadena vacía.
 * @param {ReadonlyArray<number>} numbers
 * @returns {string}
 */
export function formatStopRanges(numbers) {
  /** @type {string[]} */
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of [...(numbers ?? [])].toSorted((a, b) => a - b)) {
    if (prev !== null && n === prev + 1) {
      prev = n;
      continue;
    }
    if (start !== null) parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  if (start !== null) parts.push(start === prev ? String(start) : `${start}–${prev}`);
  return parts.join(', ');
}
