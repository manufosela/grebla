/**
 * Composition root de Motivadores: selecciona la persistencia (memory/firestore).
 * Los agregados públicos los calcula la Cloud Function `onMotivatorSessionWritten`
 * (Admin SDK) al guardar una sesión; el cliente solo lee `/motivatorAggregates`.
 *
 * @typedef {import('../domain/ports.js').MotivatorsPersistence} MotivatorsPersistence
 */
import { createMemoryMotivatorsPersistence } from '../infrastructure/memory/index.js';
import { createFirestoreMotivatorsPersistence } from '../infrastructure/firestore/persistence.js';

/**
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: MotivatorsPersistence }>}
 */
export async function createMotivatorsContainer(options = {}) {
  const { mode = 'firestore', db = null, seed } = options;
  if (mode === 'memory') {
    return { mode, persistence: createMemoryMotivatorsPersistence(seed) };
  }
  if (mode === 'firestore') {
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    return { mode, persistence: createFirestoreMotivatorsPersistence(database) };
  }
  throw new Error(`Modo de container Motivadores desconocido: ${mode}`);
}
