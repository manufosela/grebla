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
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {string|null} [options.leaderUid]  Líder que consulta; se estampa como ownerLeaderUid al crear repos.
 * @param {boolean} [options.viewAll]  true (superadmin): la lista de repos incluye TODA la organización.
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: DoraPersistence }>}
 */
export async function createDoraContainer(options = {}) {
  const { mode = 'firestore', db = null, leaderUid = null, viewAll = false, seed } = options;
  if (mode === 'memory') {
    return {
      mode,
      persistence: createMemoryDoraPersistence(seed, { leaderUid, viewAll }),
      refresh: async () => ({ results: [] }),
    };
  }
  if (mode === 'firestore') {
    if (!leaderUid) {
      throw new Error('El modo Firestore requiere leaderUid (resuelto por el cliente)');
    }
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
    return { mode, persistence: createFirestoreDoraPersistence(database, leaderUid, { viewAll }), refresh };
  }
  throw new Error(`Modo de container DORA desconocido: ${mode}`);
}
