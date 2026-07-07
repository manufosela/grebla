/**
 * Casos de uso de las ACCIONES de O2O (compromisos). Cuelgan de la persona, así
 * que el ingeniero puede verlas en su espacio (heredan las reglas de la persona).
 * No contienen datos sensibles del líder.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OAction} O2OAction
 */

/**
 * Lista las acciones de una persona (más recientes primero).
 * @param {O2OPersistence} persistence @param {string} personId @returns {Promise<O2OAction[]>}
 */
export function listActions(persistence, personId) {
  if (!personId) throw new Error('Falta la persona para listar sus acciones.');
  return persistence.actions.listByPerson(personId);
}

/**
 * Crea una acción. Exige descripción; owner por defecto la persona; abierta.
 * @param {O2OPersistence} persistence @param {string} personId @param {Partial<O2OAction>} input @returns {Promise<string>}
 */
export async function createAction(persistence, personId, input) {
  if (!personId) throw new Error('Falta la persona.');
  const description = input?.description?.trim();
  if (!description) throw new Error('La acción necesita una descripción.');
  /** @type {O2OAction} */
  const action = {
    description,
    owner: input.owner === 'leader' ? 'leader' : 'person',
    status: 'open',
    originSessionId: input.originSessionId ?? null,
    dueDate: input.dueDate,
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  return persistence.actions.create(personId, action);
}

/**
 * Actualiza campos libres de una acción (descripción, owner, dueDate…).
 * @param {O2OPersistence} persistence @param {string} personId @param {string} id @param {Partial<O2OAction>} patch @returns {Promise<void>}
 */
export function updateAction(persistence, personId, id, patch) {
  if (!id) throw new Error('Falta el id de la acción.');
  return persistence.actions.update(personId, id, patch);
}

/**
 * Alterna el estado abierta/hecha, sellando o limpiando doneAt.
 * @param {O2OPersistence} persistence @param {string} personId @param {O2OAction} action @returns {Promise<void>}
 */
export function toggleAction(persistence, personId, action) {
  const done = action.status !== 'done';
  return persistence.actions.update(personId, action.id, {
    status: done ? 'done' : 'open',
    doneAt: done ? new Date().toISOString() : null,
  });
}

/**
 * Borra una acción.
 * @param {O2OPersistence} persistence @param {string} personId @param {string} id @returns {Promise<void>}
 */
export function removeAction(persistence, personId, id) {
  if (!id) throw new Error('Falta el id de la acción a borrar.');
  return persistence.actions.remove(personId, id);
}
