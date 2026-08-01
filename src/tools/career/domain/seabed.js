/**
 * Helpers PUROS del lecho (RMR-PCS-0028 · F3): detección del lecho transversal
 * en el índice del archipiélago y layout de sus arrecifes (nodos + conexiones
 * por prereq) para la vista submarina. Sin Firebase ni DOM: se testean solos.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').IslandRef} IslandRef
 * @typedef {import('./types.js').City} City
 */

/**
 * ¿Hay un lecho (isla transversal con seabed:true) en el índice?
 * @param {ReadonlyArray<IslandRef>|null|undefined} islands
 * @returns {boolean}
 */
export function hasSeabed(islands) {
  return (islands ?? []).some((i) => i?.seabed === true);
}

/**
 * El IslandRef del lecho, o null si no hay ninguno.
 * @param {ReadonlyArray<IslandRef>|null|undefined} islands
 * @returns {IslandRef|null}
 */
export function seabedRef(islands) {
  return (islands ?? []).find((i) => i?.seabed === true) ?? null;
}

/**
 * @typedef {Object} ArrecifeNode
 * @property {string} id
 * @property {string} name
 * @property {import('./types.js').CityKind} kind
 * @property {number} x  0..100
 * @property {number} y  0..100
 * @property {number} weight
 * @property {string} area
 *
 * @typedef {Object} ArrecifeEdge
 * @property {string} from  id del arrecife prerequisito
 * @property {string} to    id del arrecife que lo requiere
 */

/**
 * Escena del lecho para la vista submarina: los arrecifes como NODOS y las
 * conexiones como ARISTAS (from→to por cada prereq). Descarta prereqs que
 * apunten a un arrecife inexistente (no dibuja aristas colgantes). Función PURA.
 * @param {CareerMap|null|undefined} map
 * @returns {{ nodes: ArrecifeNode[], edges: ArrecifeEdge[] }}
 */
export function seabedScene(map) {
  const cities = map?.cities ?? [];
  const ids = new Set(cities.map((c) => c.id));
  const nodes = cities.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    x: c.x,
    y: c.y,
    weight: c.weight,
    area: c.area,
  }));
  const edges = [];
  for (const c of cities) {
    for (const p of c.prereqs ?? []) {
      if (ids.has(p)) edges.push({ from: p, to: c.id });
    }
  }
  return { nodes, edges };
}
