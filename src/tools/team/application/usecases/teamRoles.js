/**
 * Casos de uso del catálogo de roles funcionales del equipo (CRUD del líder).
 * Mismo patrón que las áreas de conocimiento.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').TeamRole} TeamRole
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addTeamRole(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del rol es obligatorio');
  return persistence.teamRoles.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<TeamRole[]>}
 */
export function listTeamRoles(persistence) {
  return persistence.teamRoles.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeTeamRole(persistence, id) {
  return persistence.teamRoles.remove(id);
}
