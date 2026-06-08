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
 * @returns {PeopleRepository}
 */
export function createMemoryPeopleRepository(seed = [], now = () => new Date().toISOString()) {
  /** @type {Map<string, Person>} */
  const store = new Map(seed.map((p) => [p.id, { ...p }]));

  return {
    async list() {
      return [...store.values()].map((p) => ({ ...p }));
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
  };
}
