/**
 * Casos de uso de personas. Orquestan el PeopleRepository del puerto de
 * persistencia. La UI nunca toca el repo directamente.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Person} Person
 */

/**
 * Alta de una persona (activa por defecto).
 * @param {PersistencePort} persistence
 * @param {{ name: string, teamRole: string, startDate: string, active?: boolean }} input
 * @returns {Promise<string>}
 */
export function addPerson(persistence, input) {
  return persistence.people.create({ active: true, ...input });
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Person[]>}
 */
export async function listActivePeople(persistence) {
  const people = await persistence.people.list();
  return people.filter((p) => p.active);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function deactivatePerson(persistence, id) {
  return persistence.people.deactivate(id);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @param {Partial<Person>} patch
 * @returns {Promise<void>}
 */
export function updatePerson(persistence, id, patch) {
  return persistence.people.update(id, patch);
}
