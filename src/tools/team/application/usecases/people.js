/**
 * Casos de uso de personas. Orquestan el PeopleRepository del puerto de
 * persistencia. La UI nunca toca el repo directamente.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Person} Person
 */
import { turnover } from '../../domain/services/turnover.js';

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
 * Normaliza el usuario de GitHub de una persona: recortado, o null si vacío.
 * @param {string} [v]
 * @returns {string|null}
 */
export function normalizeGithubLogin(v) {
  return String(v ?? '').trim() || null;
}

/**
 * Alta de una persona (activa por defecto). `teamRoles` es un array de roles del
 * catálogo (puede ir vacío). `githubLogin` es opcional (para DORA).
 * @param {PersistencePort} persistence
 * @param {{ name: string, teamRoles?: string[], startDate: string, active?: boolean, githubLogin?: string }} input
 * @returns {Promise<string>}
 */
export function addPerson(persistence, input) {
  const { teamRoles = [], teamRole: _legacy, githubLogin, ...rest } = input;
  return persistence.people.create({
    active: true,
    teamRoles,
    githubLogin: normalizeGithubLogin(githubLogin),
    ...rest,
  });
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
 * Personas dadas de baja (no se borran: conservan su histórico), ordenadas por
 * fecha de baja descendente. Alimenta la sección "Bajas" y la rotación.
 * @param {PersistencePort} persistence
 * @returns {Promise<Person[]>}
 */
export async function listDepartedPeople(persistence) {
  const people = await persistence.people.list();
  return people
    .filter((p) => !p.active)
    .map(normalizePerson)
    .sort((a, b) => String(b.deactivatedAt ?? '').localeCompare(String(a.deactivatedAt ?? '')));
}

/**
 * Tasa de rotación del equipo en un periodo (agregado, no compara personas).
 * @param {PersistencePort} persistence
 * @param {{ from: string|number|Date, to: string|number|Date }} period
 * @returns {Promise<ReturnType<typeof turnover>>}
 */
export async function getTurnover(persistence, period) {
  const people = await persistence.people.list();
  return turnover(people, period);
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
