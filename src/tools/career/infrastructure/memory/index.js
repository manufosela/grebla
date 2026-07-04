/**
 * Persistencia in-memory del Mapa de Carrera (tests/prototipos).
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 * @typedef {import('../../domain/achievements.js').Achievements} Achievements
 */
import { mergeAchievements, normalizeAchievements } from '../../domain/achievements.js';

/**
 * @param {Record<string, import('../../domain/types.js').Journey>} [seed]
 * @returns {CareerStore}
 */
export function createMemoryCareerStore(seed = {}) {
  /** @type {Map<string, import('../../domain/types.js').Journey>} */
  const store = new Map(Object.entries(seed));
  /** Logros por persona (MC-21), misma semántica merge que Firestore. @type {Map<string, Achievements>} */
  const achievements = new Map();
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
    achievements: {
      async get(personId) {
        const a = achievements.get(personId);
        return a ? structuredClone(a) : null;
      },
      // Solo-añadir (MC-21): fusiona el parche sin pisar registros existentes,
      // como el setDoc merge de la persistencia Firestore.
      async save(personId, patch) {
        const current = achievements.get(personId) ?? normalizeAchievements(null);
        achievements.set(personId, structuredClone(mergeAchievements(current, patch)));
      },
    },
  };
}
