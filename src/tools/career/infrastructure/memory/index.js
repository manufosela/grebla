/**
 * Persistencia in-memory del Mapa de Carrera (tests/prototipos).
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 * @typedef {import('../../domain/achievements.js').Achievements} Achievements
 * @typedef {import('../../domain/endorsements.js').Endorsements} Endorsements
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
  /** Avales del manager por persona (JG-6). @type {Map<string, Endorsements>} */
  const endorsements = new Map();
  /** Consultas al brujo por persona (MC-22): personId → (id → consulta). @type {Map<string, Map<string, Record<string, unknown>>>} */
  const questions = new Map();
  /** Tiempo de juego por persona (MC-23). @type {Map<string, { totalMinutes: number, byDay: Record<string, number> }>} */
  const playtime = new Map();
  let nextQuestionId = 1;
  /** @param {import('../../domain/types.js').Journey} j */
  const clone = (j) => ({
    ...j,
    visitedCities: [...(j.visitedCities ?? [])],
    plannedRoute: [...(j.plannedRoute ?? [])],
    evidences: structuredClone(j.evidences ?? {}),
    // Reto activo (JG-5): copia profunda — el store no comparte referencias.
    challenge: j.challenge ? structuredClone(j.challenge) : null,
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
    // Avales del manager (JG-6): mismo contrato que la persistencia Firestore
    // (repos tontos por casa; la garantía de no re-escribir vive en el caso
    // de uso endorseCity, vía addEndorsement).
    endorsements: {
      async get(personId) {
        const e = endorsements.get(personId);
        return e ? structuredClone(e) : null;
      },
      async endorse(personId, cityId, record) {
        const current = endorsements.get(personId) ?? { byCity: {} };
        current.byCity[cityId] = structuredClone(record);
        endorsements.set(personId, current);
      },
      async unendorse(personId, cityId) {
        const current = endorsements.get(personId);
        if (!current) return;
        delete current.byCity[cityId];
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
    // Tiempo de juego (MC-23): mismo contrato que la persistencia Firestore
    // (incrementos de total+día juntos; poda por claves de día).
    playtime: {
      async get(personId) {
        const p = playtime.get(personId);
        return p ? structuredClone(p) : null;
      },
      async increment(personId, { day, minutes }) {
        const current = playtime.get(personId) ?? { totalMinutes: 0, byDay: {} };
        current.totalMinutes += minutes;
        current.byDay[day] = (current.byDay[day] ?? 0) + minutes;
        playtime.set(personId, current);
      },
      async prune(personId, days) {
        const current = playtime.get(personId);
        if (!current) throw new Error(`Playtime no encontrado para podar: "${personId}"`);
        for (const day of days) delete current.byDay[day];
      },
    },
  };
}
