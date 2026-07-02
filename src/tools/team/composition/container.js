/**
 * Composition root del seguimiento de equipo. Único lugar que conoce a la vez
 * los puertos y sus implementaciones: lee el modo y devuelve el PersistencePort
 * adecuado. La UI y los casos de uso reciben el puerto inyectado.
 *
 * - mode 'memory'    → adapters in-memory (tests, prototipos).
 * - mode 'firestore' → adapters Firestore bajo /tenants/{tenantId}. Las personas
 *   viven a nivel de tenant con `ownerLeaderUid`; `leaderUid` es el líder que
 *   consulta (filtra sus personas por owner), no parte del path.
 *   `tenantId` y `leaderUid` los resuelve el cliente (por dominio + sesión) y se
 *   pasan aquí; `db` se resuelve de src/lib/firebase.js por import dinámico.
 *
 * @typedef {import('../domain/ports.js').PersistencePort} PersistencePort
 */
import { createMemoryPersistence } from '../infrastructure/memory/index.js';
import { createFirestorePersistence } from '../infrastructure/firestore/persistence.js';
import { createNullStorageAdapter } from '../infrastructure/storage/nullStorage.js';
import { createFirebaseStorageAdapter } from '../infrastructure/storage/firebaseStorage.js';

/**
 * Selecciona el adapter de ficheros según settings.features.fileStorage. OFF por
 * defecto (NullStorageAdapter). Si está ON y no se inyecta `storage`, se resuelve
 * getStorage(app) desde firebase.js por import dinámico.
 * @param {import('../domain/ports.js').PersistencePort} persistence
 * @param {import('firebase/storage').FirebaseStorage|null} storage
 * @returns {Promise<import('../domain/ports.js').FileStoragePort>}
 */
async function resolveStorage(persistence, storage) {
  const { features } = await persistence.config.getSettings();
  if (!features.fileStorage) return createNullStorageAdapter();
  let instance = storage;
  if (!instance) {
    const { app } = await import('../../../lib/firebase.js');
    const { getStorage } = await import('firebase/storage');
    instance = getStorage(app);
  }
  return createFirebaseStorageAdapter(instance);
}

/**
 * @param {Object} [options]
 * @param {'memory'|'firestore'} [options.mode]
 * @param {import('firebase/firestore').Firestore|null} [options.db]
 * @param {string|null} [options.leaderUid]
 * @param {import('firebase/storage').FirebaseStorage|null} [options.storage]
 * @param {boolean} [options.viewAll]  true (superadmin): la lista de personas incluye a TODA la organización.
 * @param {object} [options.seed]  Solo para mode 'memory'.
 * @returns {Promise<{ mode: string, persistence: PersistencePort, storage: import('../domain/ports.js').FileStoragePort }>}
 */
export async function createTeamContainer(options = {}) {
  const { mode = 'firestore', db = null, leaderUid = null, storage = null, viewAll = false, seed } = options;

  if (mode === 'memory') {
    const persistence = createMemoryPersistence(seed);
    return { mode, persistence, storage: await resolveStorage(persistence, storage) };
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
    const persistence = createFirestorePersistence(database, leaderUid, { viewAll });
    return { mode, persistence, storage: await resolveStorage(persistence, storage) };
  }

  throw new Error(`Modo de container desconocido: ${mode}`);
}
