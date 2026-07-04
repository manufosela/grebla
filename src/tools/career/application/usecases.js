/**
 * Casos de uso del Mapa de Carrera. El mapa es una isla de muestra (en código);
 * el journey es de la PERSONA del equipo y se persiste en su subárbol
 * (/people/{personId}/career/journey).
 *
 * @typedef {import('../domain/ports.js').CareerStore} CareerStore
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 * @typedef {import('../domain/types.js').Journey} Journey
 * @typedef {import('../domain/types.js').CityEvidence} CityEvidence
 */
import { SAMPLE_MAPS, ISLAND } from '../data/maps.js';
import { EMPTY_JOURNEY, DEFAULT_ISLAND_ID } from '../domain/types.js';
import { mapPoints, totalPoints, progressPct, isReachable, reachableCityIds, levelFor } from '../domain/progress.js';

/** @returns {ReadonlyArray<CareerMap>} */
export function getMaps() {
  return SAMPLE_MAPS;
}

/** @param {string} id @returns {CareerMap|null} */
export function getMap(id) {
  return SAMPLE_MAPS.find((m) => m.id === id) ?? null;
}

/**
 * Isla SEMILLA en código (fallback). En runtime el mapa se carga desde Firestore
 * con `getCareerMap()` (src/lib/careerMap.js); esta función expone la semilla para
 * los tests de dominio y como respaldo si no hay documento persistido.
 * @returns {CareerMap}
 */
export function getIslandMap() {
  return ISLAND;
}

/** Normaliza un journey persistido (o crea uno vacío) al modelo actual. @returns {Journey} */
function normalizeJourney(j) {
  if (!j) {
    return {
      ...EMPTY_JOURNEY,
      visitedCities: [],
      plannedRoute: [],
      visitedIslands: [DEFAULT_ISLAND_ID],
      evidences: {},
    };
  }
  const island = typeof j.currentIsland === 'string' ? j.currentIsland.trim() : '';
  const currentIsland = island || DEFAULT_ISLAND_ID;
  // Islas pisadas (MC-20): saneadas y sin duplicados. Migración suave de
  // journeys previos a MC-20: la isla actual siempre figura como pisada.
  const visitedIslands = [
    ...new Set(
      (Array.isArray(j.visitedIslands) ? j.visitedIslands : [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (!visitedIslands.includes(currentIsland)) visitedIslands.push(currentIsland);
  return {
    visitedCities: [...(j.visitedCities ?? [])],
    currentCity: j.currentCity ?? null,
    plannedRoute: [...(j.plannedRoute ?? [])],
    // Journeys previos al archipiélago (MC-14) no traen isla: la de inicio.
    currentIsland,
    visitedIslands,
    evidences: { ...(j.evidences ?? {}) },
  };
}

/**
 * @param {CareerStore} store @param {string} personId
 * @returns {Promise<Journey>}
 */
export async function getJourney(store, personId) {
  return normalizeJourney(await store.journeys.get(personId));
}

/**
 * Marca/desmarca una ciudad como visitada. Para visitar exige que sea alcanzable
 * (y no esté deprecada).
 * @param {CareerStore} store @param {string} personId @param {CareerMap} map @param {Journey} journey @param {string} cityId
 */
export async function toggleVisited(store, personId, map, journey, cityId) {
  const visited = new Set(journey.visitedCities ?? []);
  if (visited.has(cityId)) {
    visited.delete(cityId);
  } else {
    if (!isReachable(map, cityId, journey.visitedCities)) {
      throw new Error('Ciudad bloqueada: visita antes sus prerequisitos.');
    }
    visited.add(cityId);
  }
  const next = { ...journey, visitedCities: [...visited] };
  await store.journeys.save(personId, next);
  return next;
}

/** @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string|null} cityId */
export async function setCurrent(store, personId, journey, cityId) {
  const next = { ...journey, currentCity: cityId };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Viaja en barco a otra isla del archipiélago (MC-14): persiste la isla actual
 * en el journey GLOBAL de la persona y la registra como PISADA en
 * `visitedIslands` (MC-20, para el marcador 🏝️ del HUD). El viaje es libre
 * (sin gating); los prerequisitos siguen siendo por ciudad dentro de cada isla.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} islandId
 * @returns {Promise<Journey>}
 */
export async function setCurrentIsland(store, personId, journey, islandId) {
  const id = typeof islandId === 'string' ? islandId.trim() : '';
  if (!id) throw new Error('setCurrentIsland requiere el id de la isla de destino.');
  const visited = journey.visitedIslands ?? [];
  const next = {
    ...journey,
    currentIsland: id,
    visitedIslands: visited.includes(id) ? [...visited] : [...visited, id],
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Añade/quita una ciudad de la ruta planificada.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} cityId
 */
export async function toggleRoute(store, personId, journey, cityId) {
  const route = journey.plannedRoute ?? [];
  const next = {
    ...journey,
    plannedRoute: route.includes(cityId) ? route.filter((id) => id !== cityId) : [...route, cityId],
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Guarda/actualiza las evidencias de una ciudad (experiencia previa, formaciones…).
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} cityId @param {CityEvidence} evidence
 */
export async function setEvidence(store, personId, journey, cityId, evidence) {
  const next = {
    ...journey,
    evidences: { ...(journey.evidences ?? {}), [cityId]: { ...evidence } },
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Estadísticas de gamificación del journey en su mapa.
 * @param {CareerMap} map @param {Journey} journey
 */
export function stats(map, journey) {
  const visited = journey?.visitedCities ?? [];
  const pct = progressPct(map, visited);
  return {
    points: mapPoints(map, visited),
    total: totalPoints(map),
    pct,
    level: levelFor(pct),
    reachable: reachableCityIds(map, visited),
  };
}
