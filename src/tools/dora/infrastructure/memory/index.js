/**
 * Implementación in-memory de la persistencia DORA (para tests y prototipos).
 *
 * @typedef {import('../../domain/types.js').DoraRepo} DoraRepo
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */

/**
 * @param {DoraRepo[]} [seed]
 * @param {{ leaderUid?: string, viewAll?: boolean }} [options]  Espeja el adapter
 *   Firestore: `leaderUid` se estampa como ownerLeaderUid al crear y filtra la
 *   lista salvo `viewAll`. Si no se pasa `leaderUid`, no hay estampado ni filtro
 *   (comportamiento plano de los tests existentes).
 * @returns {DoraPersistence}
 */
export function createMemoryDoraPersistence(seed = [], options = {}) {
  const { leaderUid = null, viewAll = false } = options;
  /** @type {Map<string, DoraRepo>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));

  return {
    repos: {
      async list() {
        const all = [...store.values()].map((r) => ({ ...r }));
        if (viewAll || !leaderUid) return all;
        return all.filter((r) => r.ownerLeaderUid === leaderUid);
      },
      async add(input) {
        const id = crypto.randomUUID();
        store.set(id, { ...input, ...(leaderUid ? { ownerLeaderUid: leaderUid } : {}), id });
        return id;
      },
      async update(id, patch) {
        const repo = store.get(id);
        if (!repo) throw new Error(`Repo ${id} no existe`);
        store.set(id, { ...repo, ...patch, id });
      },
      async remove(id) {
        if (!store.delete(id)) throw new Error(`Repo ${id} no existe`);
      },
    },
  };
}
