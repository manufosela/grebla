/**
 * Implementación Firestore de la persistencia DORA (modelo multi-leader): la
 * config de entrega vive en /dora a nivel de instancia (raíz, no bajo el líder),
 * para que un mismo repo pueda coincidir entre líderes. Cada repo lleva
 * `ownerLeaderUid`; el líder ve por defecto los suyos (filtro por owner) y el
 * superadmin (viewAll) ve todos. Escritura owner-scoped (ver firestore.rules).
 * `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';

const reposCol = (db) => collection(db, 'dora');
const repoDoc = (db, id) => doc(db, 'dora', id);
const deploymentsCol = (db, repoId) => collection(db, 'dora', repoId, 'deployments');
const deploymentDoc = (db, repoId, id) => doc(db, 'dora', repoId, 'deployments', id);

/**
 * @param {Firestore} db
 * @param {string} leaderUid  Líder que consulta; se estampa como ownerLeaderUid al crear.
 * @param {{ viewAll?: boolean }} [options]  viewAll=true (superadmin): lista TODOS los repos de la organización.
 * @returns {DoraPersistence}
 */
export function createFirestoreDoraPersistence(db, leaderUid, options = {}) {
  if (!db) throw new Error('createFirestoreDoraPersistence requiere una instancia de Firestore (db)');
  if (!leaderUid) throw new Error('createFirestoreDoraPersistence requiere leaderUid');
  const { viewAll = false } = options;
  return {
    repos: {
      async list() {
        // El superadmin (viewAll) ve TODOS los repos (las reglas se lo permiten),
        // incluidos los legacy sin ownerLeaderUid. El líder solo ve los suyos: la
        // query se respalda con el MISMO campo del where (rules are not filters).
        const snap = viewAll
          ? await getDocs(reposCol(db))
          : await getDocs(query(reposCol(db), where('ownerLeaderUid', '==', leaderUid)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async add(input) {
        const ref = await addDoc(reposCol(db), { ...input, ownerLeaderUid: leaderUid });
        return ref.id;
      },
      async update(id, patch) {
        await setDoc(repoDoc(db, id), { ...patch }, { merge: true });
      },
      async remove(id) {
        await deleteDoc(repoDoc(db, id));
      },
    },
    deployments: {
      async add(repoId, event) {
        // `createdBy` solo se guarda si viene (no se estampa vacío). Sin
        // fallbacks silenciosos sobre datos críticos: el evento se persiste tal
        // cual lo normaliza el caso de uso.
        const ref = await addDoc(deploymentsCol(db, repoId), { ...event });
        return ref.id;
      },
      async listByRepo(repoId) {
        // Se ordena en cliente por `at` desc para no exigir un índice compuesto
        // ni depender del formato guardado; `at` es siempre ISO 8601 (ordenable).
        const snap = await getDocs(deploymentsCol(db, repoId));
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
      },
      async remove(repoId, id) {
        await deleteDoc(deploymentDoc(db, repoId, id));
      },
    },
  };
}
