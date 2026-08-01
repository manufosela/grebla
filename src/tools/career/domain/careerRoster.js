/**
 * Roster de progreso de carrera (RMR-PCS-0029 · F2b): una fila LISTADA por
 * persona del ámbito del manager, para la pestaña «Carrera» de la tool Equipo.
 * Read-only, agregado — NO es el juego. Función PURA (sin Firebase ni DOM).
 *
 * El lecho ya está excluido de la ciudadanía en archipelagoProgress, así que el
 * progreso aquí es el del mar (las islas), coherente con el pasaporte.
 *
 * @typedef {import('./types.js').IslandRef} IslandRef
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('../data/framework.js').CareerFramework} CareerFramework
 */
import { archipelagoProgress } from './citizenship.js';
import { DEFAULT_ISLAND_ID } from './types.js';

const EMPTY_JOURNEY = { visitedCities: [], visitedIslands: [], currentCity: null };

/**
 * @typedef {Object} CareerRosterRow
 * @property {string} personId
 * @property {string} name
 * @property {string|null} levelCode    código del nivel objetivo (p.ej. «L2»), o null
 * @property {string|null} levelTitle   título del nivel objetivo, o null
 * @property {number} citizenships      ciudadanías de isla conseguidas
 * @property {number} certificates      certificados totales (todas las islas)
 * @property {number} islandsVisited    islas pisadas
 * @property {string|null} currentIsland nombre de la isla actual, o null si no empezó
 * @property {boolean} started          ¿tiene recorrido iniciado?
 */

/**
 * Filas de progreso para el ámbito dado. Cada persona con su journey (o sin él).
 * @param {Object} params
 * @param {{id:string, name:string, careerTargetLevelId?:string|null}[]} params.people
 * @param {Map<string, Journey>} params.journeyById  journeys cargados por personId
 * @param {IslandRef[]} params.islands                índice del archipiélago
 * @param {CareerFramework|null} params.framework     framework (para el rótulo de nivel)
 * @returns {CareerRosterRow[]}
 */
export function careerRoster({ people, journeyById, islands, framework }) {
  const levelOf = (id) => (framework?.levels ?? []).find((l) => l.id === id) ?? null;
  const islandName = (id) => (islands ?? []).find((i) => i.id === id)?.name ?? id;
  return (people ?? []).map((p) => {
    const journey = journeyById?.get?.(p.id) ?? null;
    const prog = archipelagoProgress(journey ?? EMPTY_JOURNEY, islands ?? []);
    const certificates = (prog.islands ?? []).reduce((sum, i) => sum + (i.certificates ?? 0), 0);
    const level = levelOf(p.careerTargetLevelId);
    const started = Boolean(journey?.currentCity);
    return {
      personId: p.id,
      name: p.name,
      levelCode: level?.code ?? null,
      levelTitle: level?.title ?? null,
      citizenships: prog.citizenships ?? 0,
      certificates,
      islandsVisited: prog.islandsVisited ?? 0,
      currentIsland: started ? islandName(journey.currentIsland ?? DEFAULT_ISLAND_ID) : null,
      started,
    };
  });
}
