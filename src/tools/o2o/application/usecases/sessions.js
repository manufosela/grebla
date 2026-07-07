/**
 * Casos de uso de las SESIONES de O2O (privadas del líder). La UI importa desde
 * aquí; nunca toca puertos ni adapters. El path Firestore ya está acotado al
 * líder en el adapter, así que estas funciones no reciben su uid.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OSession} O2OSession
 */

/**
 * Lista las sesiones de una persona (más recientes primero).
 * @param {O2OPersistence} persistence @param {string} personId @returns {Promise<O2OSession[]>}
 */
export function listSessions(persistence, personId) {
  if (!personId) throw new Error('Falta la persona para listar sus O2O.');
  return persistence.sessions.listByPerson(personId);
}

/**
 * Lista TODAS las sesiones del líder (para vistas de resumen).
 * @param {O2OPersistence} persistence @returns {Promise<O2OSession[]>}
 */
export function listAllSessions(persistence) {
  return persistence.sessions.list();
}

/**
 * Lee una sesión por id (o null).
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<O2OSession|null>}
 */
export function getSession(persistence, id) {
  return persistence.sessions.get(id);
}

/**
 * Crea una sesión. Exige persona y fecha; sella createdAt.
 * @param {O2OPersistence} persistence @param {Partial<O2OSession>} input @returns {Promise<string>}
 */
export async function createSession(persistence, input) {
  const personId = input?.personId?.trim();
  const date = input?.date?.trim();
  if (!personId) throw new Error('El O2O necesita una persona.');
  if (!date) throw new Error('El O2O necesita una fecha.');
  /** @type {O2OSession} */
  const session = {
    ...input,
    personId,
    date,
    answers: input.answers ?? [],
    sharedWithPerson: input.sharedWithPerson ?? false,
    createdAt: new Date().toISOString(),
  };
  return persistence.sessions.create(session);
}

/**
 * Actualiza una sesión (sella updatedAt).
 * @param {O2OPersistence} persistence @param {string} id @param {Partial<O2OSession>} patch @returns {Promise<void>}
 */
export function updateSession(persistence, id, patch) {
  if (!id) throw new Error('Falta el id de la sesión a actualizar.');
  return persistence.sessions.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/**
 * Borra una sesión.
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<void>}
 */
export function removeSession(persistence, id) {
  if (!id) throw new Error('Falta el id de la sesión a borrar.');
  return persistence.sessions.remove(id);
}
