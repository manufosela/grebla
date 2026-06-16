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
 * @param {{ mode?: 'memory'|'firestore', db?: import('firebase/firestore').Firestore|null, tenantId?: string|null, seed?: object }} [options]
 * @returns {Promise<{ mode: string, persistence: DoraPersistence }>}
 */
export async function createDoraContainer(options = {}) {
  const { mode = 'firestore', db = null, tenantId = null, seed } = options;
  if (mode === 'memory') {
    return { mode, persistence: createMemoryDoraPersistence(seed) };
  }
  if (mode === 'firestore') {
    if (!tenantId) throw new Error('El modo Firestore requiere tenantId (resuelto por el cliente)');
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    return { mode, persistence: createFirestoreDoraPersistence(database, tenantId) };
  }
  throw new Error(`Modo de container DORA desconocido: ${mode}`);
}
