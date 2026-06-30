/**
 * Implementación in-memory de TeamRoleRepository (ver domain/ports.js). Catálogo
 * de roles funcionales del equipo, ampliable por el líder (mismo patrón que Area).
 *
 * @typedef {import('../../domain/types.js').TeamRole} TeamRole
 * @typedef {import('../../domain/ports.js').TeamRoleRepository} TeamRoleRepository
 */

/**
 * @param {TeamRole[]} [seed]
 * @param {string|null} [viewerLeaderUid] Líder que mira: list() devuelve globales +
 *   sus personales, y create() marca el rol como personal suyo. Si es null, list()
 *   devuelve todos y create() crea global (sin owner).
 * @returns {TeamRoleRepository}
 */
export function createMemoryTeamRoleRepository(seed = [], viewerLeaderUid = null) {
  /** @type {Map<string, TeamRole>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));

  return {
    async list() {
      return [...store.values()]
        .filter((r) => !viewerLeaderUid || !r.ownerLeaderUid || r.ownerLeaderUid === viewerLeaderUid)
        .map((r) => ({ ...r }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      /** @type {TeamRole} */
      const role = { id, name };
      if (viewerLeaderUid) role.ownerLeaderUid = viewerLeaderUid;
      store.set(id, role);
      return id;
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`TeamRole ${id} no existe`);
    },
  };
}
