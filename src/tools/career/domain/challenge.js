/**
 * Modo RETO del juego (JG-5): lógica PURA de las rutas de reto.
 *
 * Un reto es una RUTA por las casas de UNA isla en un orden fijo: el orden
 * topológico de sus prerequisitos (ninguna casa aparece antes que sus
 * prerequisitos de la misma isla). El catálogo no se persiste: cada ruta se
 * GENERA del contenido con `challengeRouteForIsland(map)` — determinista, así
 * que la ruta guardada en el journey y la regenerada coinciden siempre que el
 * mapa no cambie.
 *
 * La ruta ACTIVA vive en el journey (`journey.challenge`); el modo de juego es
 * DERIVADO: con challenge activo se juega en modo Reto, sin él en modo Libre
 * (el comportamiento de siempre, limitado por prerequisitos). Aquí no hay
 * Firestore ni DOM: todo testeable en Vitest.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('./types.js').Challenge} Challenge
 */
import { justVisitedCity } from './celebration.js';

/**
 * Sanea un challenge persistido al modelo actual (o null si no hay reto o el
 * dato es corrupto): `routeId` y al menos una parada válidos son obligatorios;
 * las paradas se limpian (strings no vacíos, sin duplicados, orden preservado)
 * y el nombre cae al genérico «Reto» si falta — la identidad del reto son sus
 * paradas, no su rótulo.
 * @param {unknown} raw
 * @returns {Challenge|null}
 */
export function normalizeChallenge(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const routeId = typeof value.routeId === 'string' ? value.routeId.trim() : '';
  const stops = [
    ...new Set(
      (Array.isArray(value.stops) ? value.stops : [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (!routeId || stops.length === 0) return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Reto';
  return {
    routeId,
    name,
    stops,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
  };
}

/**
 * Genera la ruta de reto de una isla: TODAS sus casas no deprecadas en orden
 * topológico por prerequisitos (Kahn). Ninguna casa sale antes que sus
 * prerequisitos DE LA MISMA isla; los prerequisitos externos (otra isla) o
 * deprecados no ordenan (no son paradas de la ruta). Desempate entre casas
 * listas: mayor peso primero (lo importante antes) y, a igual peso, el orden
 * de definición del mapa — el resultado es DETERMINISTA.
 *
 * Falla en alto si los prerequisitos forman un ciclo: una ruta imposible no
 * se degrada en silencio, es un error del contenido.
 *
 * @param {CareerMap} map
 * @returns {Challenge} Reto sin arrancar (startedAt null; lo fija startChallenge).
 */
export function challengeRouteForIsland(map) {
  const cities = (map?.cities ?? []).filter((c) => !c.deprecated);
  const byId = new Map(cities.map((c, index) => [c.id, { city: c, index }]));
  const placed = new Set();
  /** @type {string[]} */
  const stops = [];
  while (stops.length < cities.length) {
    /** @type {{ city: import('./types.js').City, index: number }|null} */
    let best = null;
    for (const entry of byId.values()) {
      if (placed.has(entry.city.id)) continue;
      // Lista = todos sus prerequisitos QUE SON PARADA ya están en la ruta.
      const ready = (entry.city.prereqs ?? []).every(
        (p) => !byId.has(p) || placed.has(p),
      );
      if (!ready) continue;
      if (
        !best ||
        (entry.city.weight || 0) > (best.city.weight || 0) ||
        ((entry.city.weight || 0) === (best.city.weight || 0) && entry.index < best.index)
      ) {
        best = entry;
      }
    }
    if (!best) {
      throw new Error(
        `Los prerequisitos de la isla "${map?.name ?? map?.id ?? '?'}" forman un ciclo: no hay ruta de reto posible.`,
      );
    }
    placed.add(best.city.id);
    stops.push(best.city.id);
  }
  return {
    routeId: String(map?.id ?? ''),
    name: `Reto: ${map?.name ?? map?.id ?? ''}`,
    stops,
    startedAt: null,
  };
}

/**
 * Progreso de un reto sobre un journey.
 * @typedef {Object} ChallengeProgress
 * @property {number} done          Paradas ya certificadas (aunque fuera de orden).
 * @property {number} total         Paradas de la ruta.
 * @property {number} nextIndex     Índice (0-based) de la SIGUIENTE parada, o -1 si no queda.
 * @property {string|null} nextCityId Id de la siguiente casa (primera no visitada EN ORDEN).
 * @property {boolean} completed    true si todas las paradas están certificadas.
 */

/**
 * Progreso del reto: la SIGUIENTE casa es la primera parada no visitada EN
 * ORDEN de la ruta; las visitadas fuera de orden cuentan igual para `done`
 * (los certificados del jugador valen se consigan como se consigan).
 * @param {Challenge|null|undefined} challenge
 * @param {Journey|null|undefined} journey
 * @returns {ChallengeProgress}
 */
export function challengeProgress(challenge, journey) {
  const stops = challenge?.stops ?? [];
  const visited = new Set(journey?.visitedCities ?? []);
  const done = stops.filter((id) => visited.has(id)).length;
  const nextIndex = stops.findIndex((id) => !visited.has(id));
  return {
    done,
    total: stops.length,
    nextIndex,
    nextCityId: nextIndex >= 0 ? stops[nextIndex] : null,
    completed: stops.length > 0 && done === stops.length,
  };
}

/**
 * Número de parada (1-based) por casa, para pintar los NÚMEROS de la ruta en
 * la isla. Sin reto → mapa vacío.
 * @param {Challenge|null|undefined} challenge
 * @returns {Map<string, number>}
 */
export function stopNumberByCity(challenge) {
  return new Map((challenge?.stops ?? []).map((id, index) => [id, index + 1]));
}

/**
 * Aviso pendiente tras un cambio de journey con reto activo (JG-5).
 * @typedef {(
 *   {kind: 'challenge-next', routeId: string, name: string, nextCityId: string,
 *    stopNumber: number, done: number, total: number} |
 *   {kind: 'challenge-done', routeId: string, name: string}
 * )} ChallengeEvent
 */

/**
 * Aviso que dispara un cambio de journey con reto activo: al certificar una
 * PARADA del reto, o bien la siguiente casa (con su número de parada) o bien
 * el reto completado. Mismo gating que las celebraciones (MC-11/MC-20): solo
 * el gesto real de «obtener certificado» (visitadas anteriores + exactamente
 * una) avisa — cargar el journey de otra persona o retirar certificados no.
 * Certificar una casa AJENA al reto tampoco: el aviso es del camino, no del
 * certificado.
 * @param {Journey|null|undefined} prevJourney Journey anterior al cambio.
 * @param {Journey} nextJourney Journey nuevo (su challenge manda).
 * @returns {ChallengeEvent[]} 0 o 1 eventos (array por simetría con MC-20).
 */
export function challengeEvents(prevJourney, nextJourney) {
  const challenge = nextJourney?.challenge ?? null;
  if (!challenge) return [];
  const justId = justVisitedCity(prevJourney?.visitedCities, nextJourney?.visitedCities);
  if (justId === null || !challenge.stops.includes(justId)) return [];
  const progress = challengeProgress(challenge, nextJourney);
  if (progress.completed) {
    return [{ kind: 'challenge-done', routeId: challenge.routeId, name: challenge.name }];
  }
  return [
    {
      kind: 'challenge-next',
      routeId: challenge.routeId,
      name: challenge.name,
      nextCityId: /** @type {string} */ (progress.nextCityId),
      stopNumber: progress.nextIndex + 1,
      done: progress.done,
      total: progress.total,
    },
  ];
}
