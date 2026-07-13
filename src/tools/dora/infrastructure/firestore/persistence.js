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
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const reposCol = (db) => collection(db, 'dora');
const repoDoc = (db, id) => doc(db, 'dora', id);
const deploymentsCol = (db, repoId) => collection(db, 'dora', repoId, 'deployments');
const deploymentDoc = (db, repoId, id) => doc(db, 'dora', repoId, 'deployments', id);
const incidentsCol = (db, repoId) => collection(db, 'dora', repoId, 'incidents');
const incidentDoc = (db, repoId, id) => doc(db, 'dora', repoId, 'incidents', id);

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
        // Ámbito personal/global (como guilds/labels): el superadmin (viewAll) ve
        // TODOS; el líder ve los GLOBALES (sin owner, del superadmin) + los suyos.
        // Como la regla es `read: isSignedIn` puede leer todos y filtrar en cliente
        // (no hay query directa para "campo ausente OR igual").
        const snap = await getDocs(reposCol(db));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return viewAll ? all : all.filter((r) => !r.ownerLeaderUid || r.ownerLeaderUid === leaderUid);
      },
      async add(input) {
        // El superadmin (viewAll) crea a nivel GLOBAL (sin owner); el líder, personal.
        const data = viewAll ? { ...input } : { ...input, ownerLeaderUid: leaderUid };
        const ref = await addDoc(reposCol(db), data);
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
    incidents: {
      // Espejo de `deployments`: registro manual de incidentes (base del MTTR,
      // D4). `createdBy` solo se guarda si viene (lo normaliza el caso de uso);
      // sin fallbacks silenciosos sobre datos críticos.
      async add(repoId, incident) {
        const ref = await addDoc(incidentsCol(db, repoId), { ...incident });
        return ref.id;
      },
      async listByRepo(repoId) {
        // Se ordena en cliente por `startedAt` desc para no exigir un índice
        // compuesto; `startedAt` es siempre ISO 8601 (ordenable como string).
        const snap = await getDocs(incidentsCol(db, repoId));
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      },
      async update(repoId, id, patch) {
        await setDoc(incidentDoc(db, repoId, id), { ...patch }, { merge: true });
      },
      async remove(repoId, id) {
        await deleteDoc(incidentDoc(db, repoId, id));
      },
    },
  };
}
