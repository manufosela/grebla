/**
 * Implementación in-memory de LabelRepository (ver domain/ports.js). Catálogo de
 * labels con ámbito personal/global, mismo modelo que Guild.
 *
 * @typedef {import('../../domain/types.js').Label} Label
 * @typedef {import('../../domain/ports.js').LabelRepository} LabelRepository
 */

/**
 * @param {Label[]} [seed]
 * @param {string|null} [viewerLeaderUid] Líder que mira: list() devuelve globales +
 *   sus personales, y create() marca el label como personal suyo. Si es null,
 *   list() devuelve todos y create() crea global (sin owner).
 * @returns {LabelRepository}
 */
export function createMemoryLabelRepository(seed = [], viewerLeaderUid = null) {
  /** @type {Map<string, Label>} */
  const store = new Map(seed.map((l) => [l.id, { ...l }]));

  return {
    async list() {
      return [...store.values()]
        .filter((l) => !viewerLeaderUid || !l.ownerLeaderUid || l.ownerLeaderUid === viewerLeaderUid)
        .map((l) => ({ ...l }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      /** @type {Label} */
      const label = { id, name };
      if (viewerLeaderUid) label.ownerLeaderUid = viewerLeaderUid;
      store.set(id, label);
      return id;
    },
    async update(id, patch) {
      const current = store.get(id);
      if (!current) throw new Error(`Label ${id} no existe`);
      store.set(id, { ...current, ...patch });
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`Label ${id} no existe`);
    },
    async promote(id) {
      const current = store.get(id);
      if (!current) throw new Error(`Label ${id} no existe`);
      const next = { ...current };
      delete next.ownerLeaderUid;
      store.set(id, next);
    },
  };
}
