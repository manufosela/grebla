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
  /** Consultas al brujo por persona (MC-22): personId → (id → consulta). @type {Map<string, Map<string, Record<string, unknown>>>} */
  const questions = new Map();
  let nextQuestionId = 1;
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
    // Consultas al brujo (MC-22): mismo contrato que la persistencia Firestore
    // (repos tontos; ids autogenerados deterministas para los tests).
    questions: {
      async listByPerson(personId) {
        const byId = questions.get(personId) ?? new Map();
        return [...byId.entries()].map(([id, q]) => ({ id, ...structuredClone(q) }));
      },
      async ask(personId, question) {
        const byId = questions.get(personId) ?? new Map();
        const id = `q${nextQuestionId}`;
        nextQuestionId += 1;
        byId.set(id, structuredClone(question));
        questions.set(personId, byId);
        return { id };
      },
      async answer(personId, questionId, patch) {
        const q = questions.get(personId)?.get(questionId);
        if (!q) throw new Error(`Consulta al brujo no encontrada: "${questionId}"`);
        Object.assign(q, structuredClone(patch));
      },
      async markSeen(personId, questionId, patch) {
        const q = questions.get(personId)?.get(questionId);
        if (!q) throw new Error(`Consulta al brujo no encontrada: "${questionId}"`);
        q.status = patch.status;
        q.seenAt = patch.seenAt;
      },
    },
  };
}
