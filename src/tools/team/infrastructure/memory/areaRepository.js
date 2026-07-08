/**
 * Implementación in-memory de AreaRepository (ver domain/ports.js). Catálogo de
 * áreas de conocimiento con ámbito personal/global, mismo modelo que Guild y Label.
 *
 * @typedef {import('../../domain/types.js').Area} Area
 * @typedef {import('../../domain/ports.js').AreaRepository} AreaRepository
 */

/**
 * @param {Area[]} [seed]
 * @param {string|null} [viewerLeaderUid] Líder que mira: list() devuelve globales +
 *   sus personales, y create() marca el área como personal suya. Si es null, list()
 *   devuelve todas y create() crea global (sin owner).
 * @returns {AreaRepository}
 */
export function createMemoryAreaRepository(seed = [], viewerLeaderUid = null) {
  /** @type {Map<string, Area>} */
  const store = new Map(seed.map((a) => [a.id, { ...a }]));

  return {
    async list() {
      return [...store.values()]
        .filter((a) => !viewerLeaderUid || !a.ownerLeaderUid || a.ownerLeaderUid === viewerLeaderUid)
        .map((a) => ({ ...a }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      /** @type {Area} */
      const area = { id, name };
      if (viewerLeaderUid) area.ownerLeaderUid = viewerLeaderUid;
      store.set(id, area);
      return id;
    },
    async update(id, patch) {
      const current = store.get(id);
      if (!current) throw new Error(`Area ${id} no existe`);
      store.set(id, { ...current, ...patch });
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`Area ${id} no existe`);
    },
    async promote(id) {
      const current = store.get(id);
      if (!current) throw new Error(`Area ${id} no existe`);
      const next = { ...current };
      delete next.ownerLeaderUid;
      store.set(id, next);
    },
  };
}
