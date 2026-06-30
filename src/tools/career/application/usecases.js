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
import { EMPTY_JOURNEY } from '../domain/types.js';
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
  if (!j) return { ...EMPTY_JOURNEY, visitedCities: [], plannedRoute: [], evidences: {} };
  return {
    visitedCities: [...(j.visitedCities ?? [])],
    currentCity: j.currentCity ?? null,
    plannedRoute: [...(j.plannedRoute ?? [])],
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
