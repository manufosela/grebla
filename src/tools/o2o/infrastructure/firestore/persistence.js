/**
 * Adapter Firestore de la persistencia O2O.
 *   /o2oGuides/{guideId}          plantilla de guía (catálogo de instancia)
 *   /o2oForms/{formId}            formulario previo (catálogo de instancia)
 *   /leaders/{leaderUid}/o2o/{id} SESIONES privadas del líder
 * Las reglas de Firestore controlan el acceso: plantillas legibles por firmados y
 * editables por líder/superadmin; las sesiones solo por el líder dueño. El
 * ingeniero no tiene ruta a las sesiones (su proyección compartida se sirve por
 * Cloud Function en fases siguientes).
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 */
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, orderBy,
} from 'firebase/firestore';

/** Repo de sesiones que exige un líder; sin él, cualquier operación falla claro. */
function sessionRepo(db, leaderUid) {
  const need = () => {
    if (!leaderUid) throw new Error('Las sesiones de O2O requieren un líder autenticado.');
    return leaderUid;
  };
  const col = () => collection(db, 'leaders', need(), 'o2o');
  const ref = (id) => doc(db, 'leaders', need(), 'o2o', id);
  const map = (snap) => snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  return {
    // Sin orderBy compuesto: se filtra por persona y se ordena en cliente (evita índice).
    async listByPerson(personId) {
      const snap = await getDocs(query(col(), where('personId', '==', personId)));
      return map(snap).sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    async list() {
      return map(await getDocs(query(col(), orderBy('date', 'desc'))));
    },
    async get(id) {
      const d = await getDoc(ref(id));
      return d.exists() ? /** @type {any} */ ({ id: d.id, ...d.data() }) : null;
    },
    async create(input) {
      const data = { ...input };
      delete data.id;
      const created = await addDoc(col(), data);
      return created.id;
    },
    async update(id, patch) {
      await setDoc(ref(id), { ...patch }, { merge: true });
    },
    async remove(id) {
      await deleteDoc(ref(id));
    },
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string|null} [leaderUid]  Líder autenticado (acota el path de las sesiones).
 * @returns {O2OPersistence}
 */
export function createFirestoreO2O(db, leaderUid = null) {
  const guideDoc = (id) => doc(db, 'o2oGuides', id);
  const formDoc = (id) => doc(db, 'o2oForms', id);
  return {
    guides: {
      async get(id) {
        const d = await getDoc(guideDoc(id));
        return d.exists() ? /** @type {any} */ ({ id: d.id, ...d.data() }) : null;
      },
      async save(id, guide) {
        await setDoc(guideDoc(id), { ...guide, id }, { merge: true });
      },
    },
    forms: {
      async get(id) {
        const d = await getDoc(formDoc(id));
        return d.exists() ? /** @type {any} */ ({ id: d.id, ...d.data() }) : null;
      },
      async save(id, form) {
        await setDoc(formDoc(id), { ...form, id }, { merge: true });
      },
    },
    sessions: sessionRepo(db, leaderUid),
  };
}
