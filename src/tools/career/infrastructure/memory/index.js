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
  return {
    journeys: {
      async get(uid) {
        const j = store.get(uid);
        return j ? { ...j, visited: [...(j.visited ?? [])] } : null;
      },
      async save(uid, journey) {
        store.set(uid, { ...journey, visited: [...(journey.visited ?? [])] });
      },
    },
  };
}
