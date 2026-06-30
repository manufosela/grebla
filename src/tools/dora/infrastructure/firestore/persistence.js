/**
 * Implementación Firestore de la persistencia DORA (modelo multi-leader): la
 * config de entrega vive en /dora a nivel de instancia (lectura: autenticados;
 * escritura: superadmin, ver firestore.rules). `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const reposCol = (db) => collection(db, 'dora');
const repoDoc = (db, id) => doc(db, 'dora', id);

/**
 * @param {Firestore} db
 * @returns {DoraPersistence}
 */
export function createFirestoreDoraPersistence(db) {
  if (!db) throw new Error('createFirestoreDoraPersistence requiere una instancia de Firestore (db)');
  return {
    repos: {
      async list() {
        const snap = await getDocs(reposCol(db));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async add(input) {
        const ref = await addDoc(reposCol(db), { ...input });
        return ref.id;
      },
      async update(id, patch) {
        await setDoc(repoDoc(db, id), { ...patch }, { merge: true });
      },
      async remove(id) {
        await deleteDoc(repoDoc(db, id));
      },
    },
  };
}
