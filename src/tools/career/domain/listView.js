/**
 * Lógica pura para la vista LISTA de la ruta de carrera (RMR-TSK-0205): estado de
 * cada tema (casa) para sus badges y agrupación por comarca. Reutiliza el estado
 * canónico de `progress.js` (`cityStatus`) y los avales de `endorsements.js`. Sin
 * DOM ni Firestore, para poder testearlo aislado.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').City} City
 * @typedef {import('./types.js').Area} Area
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('./endorsements.js').Endorsements} Endorsements
 *
 * @typedef {Object} TopicState
 * @property {boolean} done        certificada (visitada)
 * @property {boolean} available   alcanzable (prerequisitos cumplidos), aún no hecha
 * @property {boolean} blocked     con prerequisitos pendientes
 * @property {boolean} deprecated  en desuso (no visitable)
 * @property {boolean} current     es la casa actual del journey
 * @property {boolean} inRoute     está en la ruta planificada
 * @property {boolean} endorsed    avalada por el manager
 */
import { cityStatus } from './progress.js';
import { endorsementFor } from './endorsements.js';

/**
 * Estado de un tema para la vista lista. `map` es el mapa de la ISLA a la que
 * pertenece la ciudad (necesario para resolver sus prerequisitos).
 * @param {City} city
 * @param {{ map: CareerMap, journey?: Journey, endorsements?: Endorsements }} ctx
 * @returns {TopicState}
 */
export function topicState(city, { map, journey, endorsements } = {}) {
  const status = cityStatus(map, city.id, journey ?? {});
  return {
    done: status === 'visited',
    available: status === 'available',
    blocked: status === 'blocked',
    deprecated: status === 'deprecated',
    current: (journey?.currentCity ?? null) === city.id,
    inRoute: (journey?.plannedRoute ?? []).includes(city.id),
    endorsed: Boolean(endorsements && endorsementFor(endorsements, city.id)),
  };
}

/**
 * Agrupa las ciudades de una isla por comarca, en el orden de `map.areas`. Las
 * ciudades sin comarca conocida caen en un grupo final «Otros». No filtra las
 * deprecadas (el componente las atenúa). Las comarcas sin ciudades se omiten.
 * @param {CareerMap} map
 * @returns {{ area: Area, cities: City[] }[]}
 */
export function groupTopicsByArea(map) {
  const cities = map?.cities ?? [];
  const areas = map?.areas ?? [];
  const byArea = new Map(areas.map((a) => [a.id, []]));
  const orphans = [];
  for (const c of cities) {
    const bucket = byArea.get(c.area);
    if (bucket) bucket.push(c);
    else orphans.push(c);
  }
  const groups = areas
    .map((area) => ({ area, cities: byArea.get(area.id) ?? [] }))
    .filter((g) => g.cities.length > 0);
  if (orphans.length > 0) groups.push({ area: { id: '_other', name: 'Otros' }, cities: orphans });
  return groups;
}

/**
 * Resuelve una ruta (ids de casa, posiblemente multi-isla) a `[{ city, map }]` en
 * el mismo orden, buscando cada id en los mapas de todas las islas. Los ids que no
 * existen en ningún mapa se ignoran.
 * @param {string[]} routeCityIds
 * @param {Map<string, CareerMap>|Iterable<CareerMap>} islandMaps
 * @returns {{ city: City, map: CareerMap }[]}
 */
export function resolveRoute(routeCityIds, islandMaps) {
  const maps = islandMaps instanceof Map ? [...islandMaps.values()] : [...(islandMaps ?? [])];
  const index = new Map();
  for (const map of maps) {
    for (const c of map?.cities ?? []) if (!index.has(c.id)) index.set(c.id, { city: c, map });
  }
  const out = [];
  for (const id of routeCityIds ?? []) {
    const hit = index.get(id);
    if (hit) out.push(hit);
  }
  return out;
}
