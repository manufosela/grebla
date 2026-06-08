/**
 * Implementación in-memory de TeamRoleRepository (ver domain/ports.js). Catálogo
 * de roles funcionales del equipo, ampliable por el líder (mismo patrón que Area).
 *
 * @typedef {import('../../domain/types.js').TeamRole} TeamRole
 * @typedef {import('../../domain/ports.js').TeamRoleRepository} TeamRoleRepository
 */

/**
 * @param {TeamRole[]} [seed]
 * @returns {TeamRoleRepository}
 */
export function createMemoryTeamRoleRepository(seed = []) {
  /** @type {Map<string, TeamRole>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));

  return {
    async list() {
      return [...store.values()].map((r) => ({ ...r }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      store.set(id, { id, name });
      return id;
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`TeamRole ${id} no existe`);
    },
  };
}
