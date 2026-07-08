/**
 * Adapter in-memory de la persistencia O2O (tests/prototipos). Guarda guías,
 * formularios y sesiones en Maps; misma interfaz que el adapter Firestore.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OGuide} O2OGuide
 * @typedef {import('../../domain/types.js').PreO2OForm} PreO2OForm
 * @typedef {import('../../domain/types.js').O2OSession} O2OSession
 * @typedef {import('../../domain/types.js').O2OAction} O2OAction
 * @typedef {import('../../domain/types.js').O2OPeriod} O2OPeriod
 */

/**
 * @param {{ periods?: O2OPeriod[], guides?: O2OGuide[], forms?: PreO2OForm[], sessions?: O2OSession[], actions?: Array<O2OAction & { personId: string }> }} [seed]
 * @returns {O2OPersistence}
 */
export function createMemoryO2O(seed = {}) {
  /** @type {Map<string, O2OPeriod>} */
  const periods = new Map((seed.periods ?? []).map((p) => [p.id, { ...p }]));
  /** @type {Map<string, O2OGuide>} */
  const guides = new Map((seed.guides ?? []).map((g) => [g.id, { ...g }]));
  /** @type {Map<string, PreO2OForm>} */
  const forms = new Map((seed.forms ?? []).map((f) => [f.id, { ...f }]));
  /** @type {Map<string, O2OSession>} */
  const sessions = new Map((seed.sessions ?? []).map((s) => [s.id, { ...s }]));
  /** @type {Map<string, O2OAction & { personId: string }>} */
  const actions = new Map((seed.actions ?? []).map((a) => [a.id, { ...a }]));
  let periodSeq = periods.size;
  let seq = sessions.size;
  let actionSeq = actions.size;
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : -1);
  return {
    periods: {
      async list() {
        return [...periods.values()]
          .map((p) => ({ ...p }))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      },
      async get(id) {
        const p = periods.get(id);
        return p ? { ...p } : null;
      },
      async create(input) {
        periodSeq += 1;
        const id = input.id ?? `period-${periodSeq}`;
        periods.set(id, { ...input, id });
        return id;
      },
      async update(id, patch) {
        const cur = periods.get(id);
        if (cur) periods.set(id, { ...cur, ...patch, id });
      },
      async remove(id) {
        periods.delete(id);
      },
    },
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
      async listByPerson(personId, periodId) {
        return [...sessions.values()]
          .filter((s) => s.personId === personId && (!periodId || s.periodId === periodId))
          .sort(byDateDesc);
      },
      async list(periodId) {
        return [...sessions.values()]
          .filter((s) => !periodId || s.periodId === periodId)
          .sort(byDateDesc);
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
    actions: {
      async listByPerson(personId) {
        return [...actions.values()]
          .filter((a) => a.personId === personId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      },
      async create(personId, input) {
        actionSeq += 1;
        const id = input.id ?? `action-${actionSeq}`;
        actions.set(id, { ...input, id, personId });
        return id;
      },
      async update(personId, id, patch) {
        const cur = actions.get(id);
        if (cur) actions.set(id, { ...cur, ...patch, id, personId });
      },
      async remove(personId, id) {
        const cur = actions.get(id);
        if (cur?.personId === personId) actions.delete(id);
      },
    },
  };
}
