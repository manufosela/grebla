/**
 * Implementación Firestore de la persistencia LEAN (modelo multi-leader): las
 * unidades de flujo (labels de Linear: equipos Squad / gremios Chapter) viven en
 * `/leanTeams` a nivel de instancia, cada una con `ownerLeaderUid`. El líder ve las
 * suyas (filtro por owner); el superadmin (viewAll) ve todas. `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').LeanPersistence} LeanPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';

const unitsCol = (db) => collection(db, 'leanTeams');
const unitDoc = (db, id) => doc(db, 'leanTeams', id);

/**
 * @param {Firestore} db
 * @param {string} leaderUid
 * @param {{ viewAll?: boolean }} [options]
 * @returns {LeanPersistence}
 */
export function createFirestoreLeanPersistence(db, leaderUid, options = {}) {
  if (!db) throw new Error('createFirestoreLeanPersistence requiere una instancia de Firestore (db)');
  if (!leaderUid) throw new Error('createFirestoreLeanPersistence requiere leaderUid');
  const { viewAll = false } = options;
  return {
    units: {
      async list() {
        const snap = viewAll
          ? await getDocs(unitsCol(db))
          : await getDocs(query(unitsCol(db), where('ownerLeaderUid', '==', leaderUid)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async add(input) {
        const ref = await addDoc(unitsCol(db), { ...input, ownerLeaderUid: leaderUid });
        return ref.id;
      },
      async update(id, patch) {
        await setDoc(unitDoc(db, id), { ...patch }, { merge: true });
      },
      async remove(id) {
        await deleteDoc(unitDoc(db, id));
      },
    },
  };
}
