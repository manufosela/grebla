/**
 * Composition root de LEAN: selecciona la persistencia (memory/firestore) y expone
 * `refresh` (la Cloud Function que recalcula desde Linear). Espeja DORA.
 *
 * @typedef {import('../domain/ports.js').LeanPersistence} LeanPersistence
 */
import { createMemoryLeanPersistence } from '../infrastructure/memory/index.js';
import { createFirestoreLeanPersistence } from '../infrastructure/firestore/persistence.js';

/**
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {string|null} [options.leaderUid]
 * @param {boolean} [options.viewAll]
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: LeanPersistence, refresh: () => Promise<object> }>}
 */
export async function createLeanContainer(options = {}) {
  const { mode = 'firestore', db = null, leaderUid = null, viewAll = false, seed } = options;
  if (mode === 'memory') {
    return {
      mode,
      persistence: createMemoryLeanPersistence(seed, { leaderUid, viewAll }),
      refresh: async () => ({ results: [] }),
    };
  }
  if (mode === 'firestore') {
    if (!leaderUid) throw new Error('El modo Firestore requiere leaderUid (resuelto por el cliente)');
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    // refresh: invoca la Cloud Function que calcula las métricas de flujo desde Linear.
    const refresh = async () => {
      const { app } = await import('../../../lib/firebase.js');
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions(app, 'europe-west1');
      const res = await httpsCallable(fns, 'refreshLean')({});
      return res.data;
    };
    return { mode, persistence: createFirestoreLeanPersistence(database, leaderUid, { viewAll }), refresh };
  }
  throw new Error(`Modo de container LEAN desconocido: ${mode}`);
}
