/**
 * Adapter in-memory de la persistencia O2O (tests/prototipos). Guarda guías,
 * formularios y sesiones en Maps; misma interfaz que el adapter Firestore.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OGuide} O2OGuide
 * @typedef {import('../../domain/types.js').PreO2OForm} PreO2OForm
 * @typedef {import('../../domain/types.js').O2OSession} O2OSession
 */

/**
 * @param {{ guides?: O2OGuide[], forms?: PreO2OForm[], sessions?: O2OSession[] }} [seed]
 * @returns {O2OPersistence}
 */
export function createMemoryO2O(seed = {}) {
  /** @type {Map<string, O2OGuide>} */
  const guides = new Map((seed.guides ?? []).map((g) => [g.id, { ...g }]));
  /** @type {Map<string, PreO2OForm>} */
  const forms = new Map((seed.forms ?? []).map((f) => [f.id, { ...f }]));
  /** @type {Map<string, O2OSession>} */
  const sessions = new Map((seed.sessions ?? []).map((s) => [s.id, { ...s }]));
  let seq = sessions.size;
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : -1);
  return {
    guides: {
      async get(id) {
        const g = guides.get(id);
        return g ? { ...g } : null;
      },
      async save(id, guide) {
        guides.set(id, { ...guide, id });
      },
    },
    forms: {
      async get(id) {
        const f = forms.get(id);
        return f ? { ...f } : null;
      },
      async save(id, form) {
        forms.set(id, { ...form, id });
      },
    },
    sessions: {
      async listByPerson(personId) {
        return [...sessions.values()].filter((s) => s.personId === personId).sort(byDateDesc);
      },
      async list() {
        return [...sessions.values()].sort(byDateDesc);
      },
      async get(id) {
        const s = sessions.get(id);
        return s ? { ...s } : null;
      },
      async create(input) {
        seq += 1;
        const id = input.id ?? `session-${seq}`;
        sessions.set(id, { ...input, id });
        return id;
      },
      async update(id, patch) {
        const cur = sessions.get(id);
        if (cur) sessions.set(id, { ...cur, ...patch, id });
      },
      async remove(id) {
        sessions.delete(id);
      },
    },
  };
}
