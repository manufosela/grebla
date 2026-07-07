/**
 * Adapter in-memory de la persistencia O2O (tests/prototipos). Guarda guías y
 * formularios en Maps; misma interfaz que el adapter Firestore.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OGuide} O2OGuide
 * @typedef {import('../../domain/types.js').PreO2OForm} PreO2OForm
 */

/**
 * @param {{ guides?: O2OGuide[], forms?: PreO2OForm[] }} [seed]
 * @returns {O2OPersistence}
 */
export function createMemoryO2O(seed = {}) {
  /** @type {Map<string, O2OGuide>} */
  const guides = new Map((seed.guides ?? []).map((g) => [g.id, { ...g }]));
  /** @type {Map<string, PreO2OForm>} */
  const forms = new Map((seed.forms ?? []).map((f) => [f.id, { ...f }]));
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
  };
}
