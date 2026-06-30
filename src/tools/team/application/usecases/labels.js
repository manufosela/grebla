/**
 * Casos de uso del catálogo de labels (gremios/equipos). Mismo patrón que los
 * roles de equipo: el líder crea personales; el superadmin gestiona globales.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Label} Label
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addLabel(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del label es obligatorio');
  return persistence.labels.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Label[]>}
 */
export function listLabels(persistence) {
  return persistence.labels.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeLabel(persistence, id) {
  return persistence.labels.remove(id);
}
