/**
 * Persistencia in-memory del Mapa de Carrera (tests/prototipos).
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */

/**
 * @param {Record<string, import('../../domain/types.js').Journey>} [seed]
 * @returns {CareerStore}
 */
export function createMemoryCareerStore(seed = {}) {
  /** @type {Map<string, import('../../domain/types.js').Journey>} */
  const store = new Map(Object.entries(seed));
  /** @param {import('../../domain/types.js').Journey} j */
  const clone = (j) => ({
    ...j,
    visitedCities: [...(j.visitedCities ?? [])],
    plannedRoute: [...(j.plannedRoute ?? [])],
    evidences: structuredClone(j.evidences ?? {}),
  });
  return {
    journeys: {
      async get(personId) {
        const j = store.get(personId);
        return j ? clone(j) : null;
      },
      async save(personId, journey) {
        store.set(personId, clone(journey));
      },
    },
  };
}
