/**
 * Casos de uso de notas de acompañamiento (R5). Espacio sensible, NO diagnóstico,
 * sin nivel y separado de la dimensión Emocional. Nunca entra en agregados ni en
 * exports (ver application/usecases/team.js).
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').SupportNote} SupportNote
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @param {string} text
 * @returns {Promise<string>}
 */
export function addSupportNote(persistence, personId, text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('La nota de acompañamiento no puede estar vacía');
  return persistence.supportNotes.create(personId, trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @returns {Promise<SupportNote[]>}
 */
export function listSupportNotes(persistence, personId) {
  return persistence.supportNotes.listByPerson(personId);
}

/**
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeSupportNote(persistence, personId, id) {
  return persistence.supportNotes.remove(personId, id);
}
