/**
 * Adapter Firestore de la persistencia O2O.
 *   /leaders/{uid}/o2oPeriods/{id} PERIODOS del líder (guía/form embebidos)
 *   /o2oGuides/{guideId}          plantilla de referencia (catálogo de instancia)
 *   /o2oForms/{formId}            formulario de referencia (catálogo de instancia)
 *   /leaders/{leaderUid}/o2o/{id} SESIONES privadas del líder (con periodId)
 * Las reglas de Firestore controlan el acceso: plantillas legibles por firmados y
 * editables por líder/superadmin; los periodos y las sesiones solo por el líder
 * dueño. El ingeniero no tiene ruta a las sesiones (su proyección compartida se
 * sirve por Cloud Function).
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 */
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, orderBy,
} from 'firebase/firestore';

const mapDocs = (snap) => snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));

/** Repo de periodos bajo el líder (/leaders/{uid}/o2oPeriods); guía/form embebidos. */
function periodRepo(db, leaderUid) {
  const need = () => {
    if (!leaderUid) throw new Error('Los periodos de O2O requieren un líder autenticado.');
    return leaderUid;
  };
  const col = () => collection(db, 'leaders', need(), 'o2oPeriods');
  const ref = (id) => doc(db, 'leaders', need(), 'o2oPeriods', id);
  return {
    async list() {
      return mapDocs(await getDocs(query(col(), orderBy('createdAt', 'desc'))));
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

/** Repo de sesiones que exige un líder; sin él, cualquier operación falla claro. */
function sessionRepo(db, leaderUid) {
  const need = () => {
    if (!leaderUid) throw new Error('Las sesiones de O2O requieren un líder autenticado.');
    return leaderUid;
  };
  const col = () => collection(db, 'leaders', need(), 'o2o');
  const ref = (id) => doc(db, 'leaders', need(), 'o2o', id);
  const map = mapDocs;
  return {
    // Sin orderBy compuesto: se filtra por persona (y periodo en cliente), se ordena en cliente.
    async listByPerson(personId, periodId) {
      const snap = await getDocs(query(col(), where('personId', '==', personId)));
      return map(snap)
        .filter((s) => !periodId || s.periodId === periodId)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    async list(periodId) {
      const all = map(await getDocs(query(col(), orderBy('date', 'desc'))));
      return periodId ? all.filter((s) => s.periodId === periodId) : all;
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

/** Repo de acciones bajo la persona (/people/{id}/o2oActions); hereda sus reglas. */
function actionRepo(db) {
  const col = (personId) => collection(db, 'people', personId, 'o2oActions');
  const ref = (personId, id) => doc(db, 'people', personId, 'o2oActions', id);
  return {
    async listByPerson(personId) {
      const snap = await getDocs(query(col(personId), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
    },
    async create(personId, input) {
      const data = { ...input };
      delete data.id;
      const created = await addDoc(col(personId), data);
      return created.id;
    },
    async update(personId, id, patch) {
      await setDoc(ref(personId, id), { ...patch }, { merge: true });
    },
    async remove(personId, id) {
      await deleteDoc(ref(personId, id));
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
    periods: periodRepo(db, leaderUid),
    sessions: sessionRepo(db, leaderUid),
    actions: actionRepo(db),
  };
}
