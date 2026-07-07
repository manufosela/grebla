/**
 * Adapter Firestore de la persistencia O2O. Las plantillas (guía, formulario
 * previo) son catálogo a nivel de instancia:
 *   /o2oGuides/{guideId}
 *   /o2oForms/{formId}
 * Las reglas de Firestore controlan el acceso (lectura a firmados, escritura a
 * líder/superadmin). Las SESIONES (privadas del líder) y las ACCIONES llegan en
 * fases siguientes, fuera de este adapter de plantillas.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {O2OPersistence}
 */
export function createFirestoreO2O(db) {
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
  };
}
