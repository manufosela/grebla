/**
 * Implementación in-memory de la persistencia LEAN (tests y prototipos). Espeja el
 * adapter de DORA: `leaderUid` se estampa como ownerLeaderUid al crear y filtra la
 * lista salvo `viewAll`.
 *
 * @typedef {import('../../domain/types.js').LeanUnit} LeanUnit
 * @typedef {import('../../domain/ports.js').LeanPersistence} LeanPersistence
 */

/**
 * @param {LeanUnit[]} [seed]
 * @param {{ leaderUid?: string, viewAll?: boolean }} [options]
 * @returns {LeanPersistence}
 */
export function createMemoryLeanPersistence(seed = [], options = {}) {
  const { leaderUid = null, viewAll = false } = options;
  /** @type {Map<string, LeanUnit>} */
  const store = new Map(seed.map((u) => [u.id, { ...u }]));
  return {
    units: {
      async list() {
        const all = [...store.values()].map((u) => ({ ...u }));
        if (viewAll || !leaderUid) return all;
        return all.filter((u) => u.ownerLeaderUid === leaderUid);
      },
      async add(input) {
        const id = crypto.randomUUID();
        store.set(id, { ...input, ...(leaderUid ? { ownerLeaderUid: leaderUid } : {}), id });
        return id;
      },
      async update(id, patch) {
        const unit = store.get(id);
        if (!unit) throw new Error(`Unidad ${id} no existe`);
        store.set(id, { ...unit, ...patch, id });
      },
      async remove(id) {
        if (!store.delete(id)) throw new Error(`Unidad ${id} no existe`);
      },
    },
  };
}
