/**
 * Casos de uso de conversaciones (O2O / catch-up). R4: la conversación gira en
 * torno a notas/comportamientos; el vínculo a dimensiones es opcional.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Conversation} Conversation
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @param {Omit<Conversation,'id'>} input
 * @returns {Promise<string>}
 */
export function registerConversation(persistence, personId, input) {
  if (input?.type !== 'o2o' && input?.type !== 'catchup') {
    throw new Error("Tipo de conversación inválido (use 'o2o' o 'catchup')");
  }
  return persistence.conversations.create(personId, input);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @returns {Promise<Conversation[]>}
 */
export function listConversations(persistence, personId) {
  return persistence.conversations.listByPerson(personId);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @param {string} id
 * @param {Partial<Conversation>} patch
 * @returns {Promise<void>}
 */
export function updateConversation(persistence, personId, id, patch) {
  return persistence.conversations.update(personId, id, patch);
}
