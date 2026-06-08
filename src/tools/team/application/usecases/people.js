/**
 * Casos de uso de personas. Orquestan el PeopleRepository del puerto de
 * persistencia. La UI nunca toca el repo directamente.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Person} Person
 */

/**
 * Normaliza una persona leída: deriva teamRoles[] del antiguo teamRole (string)
 * si solo existe el campo legacy. Garantiza siempre un array teamRoles.
 * @param {Person & { teamRole?: string }} person
 * @returns {Person}
 */
export function normalizePerson(person) {
  const teamRoles = Array.isArray(person.teamRoles)
    ? person.teamRoles
    : person.teamRole
      ? [person.teamRole]
      : [];
  return { ...person, teamRoles };
}

/**
 * Alta de una persona (activa por defecto). `teamRoles` es un array de roles del
 * catálogo (puede ir vacío).
 * @param {PersistencePort} persistence
 * @param {{ name: string, teamRoles?: string[], startDate: string, active?: boolean }} input
 * @returns {Promise<string>}
 */
export function addPerson(persistence, input) {
  const { teamRoles = [], teamRole: _legacy, ...rest } = input;
  return persistence.people.create({ active: true, teamRoles, ...rest });
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Person[]>}
 */
export async function listActivePeople(persistence) {
  const people = await persistence.people.list();
  return people.filter((p) => p.active).map(normalizePerson);
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
