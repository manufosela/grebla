/**
 * Implementación in-memory de GuildRepository (ver domain/ports.js). Catálogo de
 * gremios (tecnologías/stack, transversales a la disciplina), ampliable por el
 * líder (mismo patrón que Area y Label).
 *
 * @typedef {import('../../domain/types.js').Guild} Guild
 * @typedef {import('../../domain/ports.js').GuildRepository} GuildRepository
 */

/**
 * @param {Guild[]} [seed]
 * @param {string|null} [viewerLeaderUid] Líder que mira: list() devuelve globales +
 *   sus personales, y create() marca el gremio como personal suyo. Si es null, list()
 *   devuelve todos y create() crea global (sin owner).
 * @returns {GuildRepository}
 */
export function createMemoryGuildRepository(seed = [], viewerLeaderUid = null) {
  /** @type {Map<string, Guild>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));

  return {
    async list() {
      return [...store.values()]
        .filter((r) => !viewerLeaderUid || !r.ownerLeaderUid || r.ownerLeaderUid === viewerLeaderUid)
        .map((r) => ({ ...r }));
    },
    async create(name) {
      const id = crypto.randomUUID();
      /** @type {Guild} */
      const guild = { id, name };
      if (viewerLeaderUid) guild.ownerLeaderUid = viewerLeaderUid;
      store.set(id, guild);
      return id;
    },
    async update(id, patch) {
      const current = store.get(id);
      if (!current) throw new Error(`Guild ${id} no existe`);
      store.set(id, { ...current, ...patch });
    },
    async remove(id) {
      if (!store.delete(id)) throw new Error(`Guild ${id} no existe`);
    },
  };
}
