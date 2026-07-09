/**
 * Implementación Firestore de la persistencia LEAN (modelo multi-leader): los
 * equipos de Linear monitorizados viven en `/leanTeams` a nivel de instancia, cada
 * uno con `ownerLeaderUid`. El líder ve los suyos (filtro por owner); el superadmin
 * (viewAll) ve todos. Escritura owner-scoped (ver firestore.rules). `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').LeanPersistence} LeanPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';

const teamsCol = (db) => collection(db, 'leanTeams');
const teamDoc = (db, id) => doc(db, 'leanTeams', id);

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
    teams: {
      async list() {
        // El líder solo ve los suyos: la query se respalda con el MISMO campo del
        // where (rules are not filters). El superadmin (viewAll) ve todos.
        const snap = viewAll
          ? await getDocs(teamsCol(db))
          : await getDocs(query(teamsCol(db), where('ownerLeaderUid', '==', leaderUid)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async add(input) {
        const ref = await addDoc(teamsCol(db), { ...input, ownerLeaderUid: leaderUid });
        return ref.id;
      },
      async update(id, patch) {
        await setDoc(teamDoc(db, id), { ...patch }, { merge: true });
      },
      async remove(id) {
        await deleteDoc(teamDoc(db, id));
      },
    },
  };
}
