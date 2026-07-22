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
 * @param {string[]|null} [branchLeaderUids] Alcance de rama del supermanager
 *   (RMR-TSK-0292): si es un array, list() devuelve las personas cuyo
 *   ownerLeaderUid está en la rama (por PROPIEDAD, sin compartidas de fuera) y
 *   tiene prioridad sobre viewerLeaderUid. Un array vacío = rama sin EMs = no ve
 *   a nadie (estado seguro, no escala a «todas»). null = sin alcance de rama.
 * @returns {PeopleRepository}
 */
export function createMemoryPeopleRepository(
  seed = [],
  now = () => new Date().toISOString(),
  viewerLeaderUid = null,
  branchLeaderUids = null,
) {
  /** @type {Map<string, Person>} */
  const store = new Map(seed.map((p) => [p.id, { ...p }]));

  const branch = Array.isArray(branchLeaderUids) ? new Set(branchLeaderUids) : null;

  /** @param {Person} p */
  const isVisible = (p) => {
    if (branch) return branch.has(p.ownerLeaderUid);
    return !viewerLeaderUid
      || p.ownerLeaderUid === viewerLeaderUid
      || (Array.isArray(p.sharedWithUids) && p.sharedWithUids.includes(viewerLeaderUid));
  };

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
