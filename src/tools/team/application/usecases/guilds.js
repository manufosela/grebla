/**
 * Casos de uso del catálogo de gremios (tecnologías/stack, transversales a la
 * disciplina) — CRUD del líder. Mismo patrón que las áreas de conocimiento.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Guild} Guild
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addGuild(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del gremio es obligatorio');
  return persistence.guilds.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Guild[]>}
 */
export function listGuilds(persistence) {
  return persistence.guilds.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeGuild(persistence, id) {
  return persistence.guilds.remove(id);
}
