/**
 * Composition root del Mapa de Carrera: selecciona la persistencia (memory/
 * firestore). Modelo multi-leader: los journeys viven a nivel de instancia.
 *
 * @typedef {import('../domain/ports.js').CareerStore} CareerStore
 */
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import { createFirestoreCareerStore } from '../infrastructure/firestore/persistence.js';

/**
 * @param {{ mode?: 'memory'|'firestore', db?: import('firebase/firestore').Firestore|null, seed?: object }} [options]
 * @returns {Promise<{ mode: string, store: CareerStore }>}
 */
export async function createCareerContainer(options = {}) {
  const { mode = 'firestore', db = null, seed } = options;
  if (mode === 'memory') {
    return { mode, store: createMemoryCareerStore(seed) };
  }
  if (mode === 'firestore') {
    let database = db;
    if (!database) {
      const firebase = await import('../../../lib/firebase.js');
      database = firebase.db;
    }
    return { mode, store: createFirestoreCareerStore(database) };
  }
  throw new Error(`Modo de container del mapa de carrera desconocido: ${mode}`);
}
