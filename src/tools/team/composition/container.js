/**
 * Composition root del seguimiento de equipo. Único lugar que conoce a la vez
 * los puertos y sus implementaciones: lee el modo y devuelve el PersistencePort
 * adecuado. La UI y los casos de uso reciben el puerto inyectado.
 *
 * - mode 'memory'    → adapters in-memory (tests, prototipos).
 * - mode 'firestore' → adapters Firestore; `db`/`ownerId` se resuelven de
 *   src/lib/firebase.js (import dinámico, para no inicializar Firebase salvo que
 *   se use realmente este modo).
 *
 * @typedef {import('../domain/ports.js').PersistencePort} PersistencePort
 */
import { createMemoryPersistence } from '../infrastructure/memory/index.js';
import { createFirestorePersistence } from '../infrastructure/firestore/persistence.js';

/**
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {string|null} [options.ownerId]
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: PersistencePort }>}
 */
export async function createTeamContainer(options = {}) {
  const { mode = 'firestore', db = null, ownerId = null, seed } = options;

  if (mode === 'memory') {
    return { mode, persistence: createMemoryPersistence(seed) };
  }

  if (mode === 'firestore') {
    let database = db;
    let owner = ownerId;
    if (!database || !owner) {
      const firebase = await import('../../../lib/firebase.js');
      database = database ?? firebase.db;
      owner = owner ?? firebase.auth.currentUser?.uid ?? null;
    }
    if (!owner) {
      throw new Error('No hay usuario autenticado: se requiere ownerId para el modo Firestore');
    }
    return { mode, persistence: createFirestorePersistence(database, owner) };
  }

  throw new Error(`Modo de container desconocido: ${mode}`);
}
