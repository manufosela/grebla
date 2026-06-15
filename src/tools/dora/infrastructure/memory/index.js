/**
 * Implementación in-memory de la persistencia DORA (para tests y prototipos).
 *
 * @typedef {import('../../domain/types.js').DoraRepo} DoraRepo
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */

/**
 * @param {DoraRepo[]} [seed]
 * @returns {DoraPersistence}
 */
export function createMemoryDoraPersistence(seed = []) {
  /** @type {Map<string, DoraRepo>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));

  return {
    repos: {
      async list() {
        return [...store.values()].map((r) => ({ ...r }));
      },
      async add(input) {
        const id = crypto.randomUUID();
        store.set(id, { ...input, id });
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
