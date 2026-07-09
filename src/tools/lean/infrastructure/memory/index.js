/**
 * Implementación in-memory de la persistencia LEAN (tests y prototipos). Espeja
 * el adapter de DORA: `leaderUid` se estampa como ownerLeaderUid al crear y filtra
 * la lista salvo `viewAll`.
 *
 * @typedef {import('../../domain/types.js').LeanTeam} LeanTeam
 * @typedef {import('../../domain/ports.js').LeanPersistence} LeanPersistence
 */

/**
 * @param {LeanTeam[]} [seed]
 * @param {{ leaderUid?: string, viewAll?: boolean }} [options]
 * @returns {LeanPersistence}
 */
export function createMemoryLeanPersistence(seed = [], options = {}) {
  const { leaderUid = null, viewAll = false } = options;
  /** @type {Map<string, LeanTeam>} */
  const store = new Map(seed.map((t) => [t.id, { ...t }]));
  return {
    teams: {
      async list() {
        const all = [...store.values()].map((t) => ({ ...t }));
        if (viewAll || !leaderUid) return all;
        return all.filter((t) => t.ownerLeaderUid === leaderUid);
      },
      async add(input) {
        const id = crypto.randomUUID();
        store.set(id, { ...input, ...(leaderUid ? { ownerLeaderUid: leaderUid } : {}), id });
        return id;
      },
      async update(id, patch) {
        const team = store.get(id);
        if (!team) throw new Error(`Equipo ${id} no existe`);
        store.set(id, { ...team, ...patch, id });
      },
      async remove(id) {
        if (!store.delete(id)) throw new Error(`Equipo ${id} no existe`);
      },
    },
  };
}
