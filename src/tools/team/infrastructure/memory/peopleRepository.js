/**
 * Implementación in-memory de PeopleRepository (ver domain/ports.js).
 * Para tests, prototipos y desarrollo sin Firebase. Estado en un Map; las
 * lecturas devuelven copias para no exponer referencias internas.
 *
 * @typedef {import('../../domain/types.js').Person} Person
 * @typedef {import('../../domain/ports.js').PeopleRepository} PeopleRepository
 */

/**
 * @param {Person[]} [seed]
 * @param {() => string} [now] Inyectable para tests deterministas (ISO date de baja).
 * @param {string|null} [viewerLeaderUid] Líder que mira: si se indica, list() devuelve
 *   solo sus personas (ownerLeaderUid) + las compartidas con él (sharedWithUids).
 *   Si es null, list() devuelve todas (paridad con el uso sin multi-líder).
 * @returns {PeopleRepository}
 */
export function createMemoryPeopleRepository(
  seed = [],
  now = () => new Date().toISOString(),
  viewerLeaderUid = null,
) {
  /** @type {Map<string, Person>} */
  const store = new Map(seed.map((p) => [p.id, { ...p }]));

  /** @param {Person} p */
  const isVisible = (p) =>
    !viewerLeaderUid
    || p.ownerLeaderUid === viewerLeaderUid
    || (Array.isArray(p.sharedWithUids) && p.sharedWithUids.includes(viewerLeaderUid));

  return {
    async list() {
      return [...store.values()].filter(isVisible).map((p) => ({ ...p }));
    },
    async getById(id) {
      const person = store.get(id);
      return person ? { ...person } : null;
    },
    async create(input) {
      const id = crypto.randomUUID();
      store.set(id, { ...input, id });
      return id;
    },
    async update(id, patch) {
      const person = store.get(id);
      if (!person) throw new Error(`Person ${id} no existe`);
      store.set(id, { ...person, ...patch, id });
    },
    async deactivate(id) {
      const person = store.get(id);
      if (!person) throw new Error(`Person ${id} no existe`);
      store.set(id, { ...person, active: false, deactivatedAt: now() });
    },
    async share(id, leaderUid, permission) {
      const person = store.get(id);
      if (!person) throw new Error(`Person ${id} no existe`);
      const sharedWith = { ...(person.sharedWith ?? {}), [leaderUid]: permission };
      store.set(id, { ...person, sharedWith, sharedWithUids: Object.keys(sharedWith) });
    },
    async unshare(id, leaderUid) {
      const person = store.get(id);
      if (!person) throw new Error(`Person ${id} no existe`);
      const sharedWith = { ...(person.sharedWith ?? {}) };
      delete sharedWith[leaderUid];
      store.set(id, { ...person, sharedWith, sharedWithUids: Object.keys(sharedWith) });
    },
    async transfer(id, newLeaderUid) {
      const person = store.get(id);
      if (!person) throw new Error(`Person ${id} no existe`);
      // Sin nuevo líder → soltar: la persona queda sin dueño (pool del superadmin).
      if (!newLeaderUid) {
        const { ownerLeaderUid, ...rest } = person;
        store.set(id, rest);
        return;
      }
      // Transferencia total: el nuevo líder es el dueño; se le retira de sharedWith
      // (ya no es "compartido", es propietario) y el anterior pierde el acceso.
      const sharedWith = { ...(person.sharedWith ?? {}) };
      delete sharedWith[newLeaderUid];
      store.set(id, {
        ...person,
        ownerLeaderUid: newLeaderUid,
        sharedWith,
        sharedWithUids: Object.keys(sharedWith),
      });
    },
  };
}
