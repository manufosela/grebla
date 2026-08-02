/**
 * Helpers PUROS del lecho (RMR-PCS-0028 · F3): detección del lecho transversal
 * en el índice del archipiélago y layout de sus arrecifes (nodos + conexiones
 * por prereq) para la vista submarina. Sin Firebase ni DOM: se testean solos.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').IslandRef} IslandRef
 * @typedef {import('./types.js').City} City
 * @typedef {import('./types.js').Journey} Journey
 */
import { cityStatus } from './progress.js';

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

/**
 * Número de ORDEN de cada arrecife (RMR-PCS-0028 · rework B): su «nivel» en el
 * grafo de prereqs — 1 para los que no dependen de nada, y 1 + el máximo nivel de
 * sus prereqs para el resto. Arrecifes del mismo nivel comparten número (se
 * pueden abordar en paralelo). Corta con seguridad ante ciclos preexistentes.
 * Función PURA.
 * @param {CareerMap|null|undefined} map
 * @returns {Map<string, number>} id del arrecife → número de orden (≥1)
 */
export function arrecifeOrder(map) {
  const cities = map?.cities ?? [];
  const byId = new Map(cities.map((c) => [c.id, c]));
  const memo = new Map();
  const level = (id, stack) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return 1; // ciclo: corta
    const prereqs = (byId.get(id)?.prereqs ?? []).filter((p) => byId.has(p));
    stack.add(id);
    const lv = prereqs.length === 0 ? 1 : 1 + Math.max(...prereqs.map((p) => level(p, stack)));
    stack.delete(id);
    memo.set(id, lv);
    return lv;
  };
  const out = new Map();
  for (const c of cities) out.set(c.id, level(c.id, new Set()));
  return out;
}

/**
 * Progreso del lecho (RMR-PCS-0028 · F4): estado de cada arrecife según el
 * journey (cityStatus) y el recuento de ENCENDIDOS (visited). El «encendido»
 * refleja el recorrido de la persona, no la evaluación del manager. Función PURA.
 * @param {CareerMap|null|undefined} map
 * @param {Journey|null|undefined} journey
 * @returns {{ statusById: Map<string,string>, lit: number, total: number }}
 */
export function seabedProgress(map, journey) {
  const cities = (map?.cities ?? []).filter((c) => !c.deprecated);
  const statusById = new Map(cities.map((c) => [c.id, cityStatus(map, c.id, journey)]));
  let lit = 0;
  for (const status of statusById.values()) if (status === 'visited') lit += 1;
  return { statusById, lit, total: cities.length };
}
