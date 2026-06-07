/**
 * Implementación in-memory de AreaRepository (ver domain/ports.js).
 * El catálogo de áreas de conocimiento lo gestiona el líder (CRUD, sin seed).
 *
 * @typedef {import('../../domain/types.js').Area} Area
 * @typedef {import('../../domain/ports.js').AreaRepository} AreaRepository
 */

/**
 * @param {Area[]} [seed]
 * @returns {AreaRepository}
 */
export function createMemoryAreaRepository(seed = []) {
  /** @type {Map<string, Area>} */
  const store = new Map(seed.map((a) => [a.id, { ...a }]));

  return {
    async list() {
      return [...store.values()].map((a) => ({ ...a }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      store.set(id, { id, name });
      return id;
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`Area ${id} no existe`);
    },
  };
}
