/**
 * Composition root de la herramienta O2O: selecciona la persistencia
 * (memory/firestore). En firestore resuelve `db` desde lib/firebase.js por
 * import dinámico.
 *
 * @typedef {import('../domain/ports.js').O2OPersistence} O2OPersistence
 */
import { createMemoryO2O } from '../infrastructure/memory/index.js';
import { createFirestoreO2O } from '../infrastructure/firestore/persistence.js';

/**
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: O2OPersistence }>}
 */
export async function createO2OContainer(options = {}) {
  const { mode = 'firestore', db = null, seed } = options;
  if (mode === 'memory') {
    return { mode, persistence: createMemoryO2O(seed) };
  }
  if (mode === 'firestore') {
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    return { mode, persistence: createFirestoreO2O(database) };
  }
  throw new Error(`Modo de container O2O desconocido: ${mode}`);
}
