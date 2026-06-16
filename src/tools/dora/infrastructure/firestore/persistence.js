/**
 * Implementación Firestore de la persistencia DORA, por tenant: la config de
 * entrega vive en /tenants/{tenantId}/dora (lectura: miembros; escritura:
 * tenant-admin, ver firestore.rules). `db` y `tenantId` se inyectan.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const reposCol = (db, tenantId) => collection(db, 'tenants', tenantId, 'dora');
const repoDoc = (db, tenantId, id) => doc(db, 'tenants', tenantId, 'dora', id);

/**
 * @param {Firestore} db
 * @param {string} tenantId
 * @returns {DoraPersistence}
 */
export function createFirestoreDoraPersistence(db, tenantId) {
  if (!db) throw new Error('createFirestoreDoraPersistence requiere una instancia de Firestore (db)');
  if (!tenantId) throw new Error('createFirestoreDoraPersistence requiere tenantId');
  return {
    repos: {
      async list() {
        const snap = await getDocs(reposCol(db, tenantId));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async add(input) {
        const ref = await addDoc(reposCol(db, tenantId), { ...input });
        return ref.id;
      },
      async update(id, patch) {
        await setDoc(repoDoc(db, tenantId, id), { ...patch }, { merge: true });
      },
      async remove(id) {
        await deleteDoc(repoDoc(db, tenantId, id));
      },
    },
  };
}
