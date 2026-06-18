/**
 * Casos de uso del Mapa de Carrera. Los mapas son de muestra (en código); el
 * journey de cada ingeniero se persiste por tenant.
 *
 * @typedef {import('../domain/ports.js').CareerStore} CareerStore
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 * @typedef {import('../domain/types.js').Journey} Journey
 */
import { SAMPLE_MAPS } from '../data/maps.js';
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
 * @param {CareerStore} store @param {string} uid
 * @returns {Promise<Journey>}
 */
export async function getJourney(store, uid) {
  const j = await store.journeys.get(uid);
  return j ?? { ...EMPTY_JOURNEY };
}

/** @param {CareerStore} store @param {string} uid @param {string} mapId */
export async function startMap(store, uid, mapId) {
  if (!getMap(mapId)) throw new Error(`Mapa desconocido: ${mapId}`);
  const journey = { mapId, visited: [], current: null, target: null };
  await store.journeys.save(uid, journey);
  return journey;
}

/**
 * Marca/desmarca una ciudad como visitada. Para visitar exige que sea alcanzable.
 * @param {CareerStore} store @param {string} uid @param {CareerMap} map @param {Journey} journey @param {string} cityId
 */
export async function toggleVisited(store, uid, map, journey, cityId) {
  const visited = new Set(journey.visited ?? []);
  if (visited.has(cityId)) {
    visited.delete(cityId);
  } else {
    if (!isReachable(map, cityId, journey.visited)) {
      throw new Error('Ciudad bloqueada: visita antes sus prerequisitos.');
    }
    visited.add(cityId);
  }
  const next = { ...journey, visited: [...visited] };
  await store.journeys.save(uid, next);
  return next;
}

/** @param {CareerStore} store @param {string} uid @param {Journey} journey @param {string|null} cityId */
export async function setCurrent(store, uid, journey, cityId) {
  const next = { ...journey, current: cityId };
  await store.journeys.save(uid, next);
  return next;
}

/** @param {CareerStore} store @param {string} uid @param {Journey} journey @param {string|null} cityId */
export async function setTarget(store, uid, journey, cityId) {
  const next = { ...journey, target: cityId };
  await store.journeys.save(uid, next);
  return next;
}

/**
 * Estadísticas de gamificación del journey en su mapa.
 * @param {CareerMap} map @param {Journey} journey
 */
export function stats(map, journey) {
  const visited = journey?.visited ?? [];
  const pct = progressPct(map, visited);
  return {
    points: mapPoints(map, visited),
    total: totalPoints(map),
    pct,
    level: levelFor(pct),
    reachable: reachableCityIds(map, visited),
  };
}
