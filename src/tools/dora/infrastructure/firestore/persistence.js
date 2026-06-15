/**
 * Implementación Firestore de la persistencia DORA. Colección GLOBAL /doraRepos
 * (la config de entrega es de la organización): lectura para autenticados,
 * escritura solo admin (ver firestore.rules). `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const reposCol = (db) => collection(db, 'doraRepos');
const repoDoc = (db, id) => doc(db, 'doraRepos', id);

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
