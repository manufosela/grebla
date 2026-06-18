/**
 * Composition root del Mapa de Carrera: selecciona la persistencia (memory/
 * firestore). En firestore necesita tenantId (lo resuelve el cliente).
 *
 * @typedef {import('../domain/ports.js').CareerStore} CareerStore
 */
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import { createFirestoreCareerStore } from '../infrastructure/firestore/persistence.js';

/**
 * @param {{ mode?: 'memory'|'firestore', db?: import('firebase/firestore').Firestore|null, tenantId?: string|null, seed?: object }} [options]
 * @returns {Promise<{ mode: string, store: CareerStore }>}
 */
export async function createCareerContainer(options = {}) {
  const { mode = 'firestore', db = null, tenantId = null, seed } = options;
  if (mode === 'memory') {
    return { mode, store: createMemoryCareerStore(seed) };
  }
  if (mode === 'firestore') {
    if (!tenantId) throw new Error('El modo Firestore requiere tenantId (resuelto por el cliente)');
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    return { mode, store: createFirestoreCareerStore(database, tenantId) };
  }
  throw new Error(`Modo de container del mapa de carrera desconocido: ${mode}`);
}
