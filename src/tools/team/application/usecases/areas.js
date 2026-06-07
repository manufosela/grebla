/**
 * Casos de uso del catálogo de áreas de conocimiento (CRUD del líder).
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Area} Area
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addArea(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del área es obligatorio');
  return persistence.areas.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Area[]>}
 */
export function listAreas(persistence) {
  return persistence.areas.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeArea(persistence, id) {
  return persistence.areas.remove(id);
}
