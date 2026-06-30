/**
 * Composition root de DORA: selecciona la persistencia (memory/firestore). En
 * firestore resuelve `db` desde lib/firebase.js por import dinámico (no inicializa
 * Firebase en otros modos).
 *
 * @typedef {import('../domain/ports.js').DoraPersistence} DoraPersistence
 */
import { createMemoryDoraPersistence } from '../infrastructure/memory/index.js';
import { createFirestoreDoraPersistence } from '../infrastructure/firestore/persistence.js';

/**
 * @param {{ mode?: 'memory'|'firestore', db?: import('firebase/firestore').Firestore|null, seed?: object }} [options]
 * @returns {Promise<{ mode: string, persistence: DoraPersistence }>}
 */
export async function createDoraContainer(options = {}) {
  const { mode = 'firestore', db = null, seed } = options;
  if (mode === 'memory') {
    return { mode, persistence: createMemoryDoraPersistence(seed), refresh: async () => ({ results: [] }) };
  }
  if (mode === 'firestore') {
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    // refresh: invoca la Cloud Function que calcula las métricas DORA desde GitHub.
    const refresh = async () => {
      const { app } = await import('../../../lib/firebase.js');
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions(app, 'europe-west1');
      const res = await httpsCallable(fns, 'refreshDora')({});
      return res.data;
    };
    return { mode, persistence: createFirestoreDoraPersistence(database), refresh };
  }
  throw new Error(`Modo de container DORA desconocido: ${mode}`);
}
