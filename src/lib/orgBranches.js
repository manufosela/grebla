/**
 * Catálogo de RAMAS de la organización (/orgBranches), configurable por el
 * superadmin (RMR-PCS-0027). Cada rama es { id, label }: engineering, product,
 * people, data… y las que el superadmin cree (marketing, operaciones) o renombre
 * (p.ej. «People» → «People & Operaciones»). Los roles (/orgRoles) referencian la
 * rama por su id; el label es lo que se muestra y se puede cambiar sin migrar roles.
 *
 * Lectura: cualquier autenticado (para pintar la rama de cada rol). Escritura:
 * solo superadmin (reglas de Firestore).
 */
import { doc, collection, getDocs, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {{ id: string, label: string }} OrgBranch */

/** @returns {Promise<OrgBranch[]>} */
export async function listOrgBranches() {
  const snap = await getDocs(collection(db, 'orgBranches'));
  return snap.docs.map((d) => ({ id: d.id, label: d.data().label ?? d.id }));
}

/**
 * Suscripción EN VIVO a las ramas (RMR-TSK-0435): renombrar una rama en el
 * panel se refleja al instante en las vistas abiertas. Devuelve la desuscripción.
 * @param {(branches: Array<{ id: string, label: string }>) => void} onBranches
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
export function watchOrgBranches(onBranches, onError) {
  return onSnapshot(
    collection(db, 'orgBranches'),
    (snap) => onBranches(snap.docs.map((d) => ({ id: d.id, label: d.data().label ?? d.id }))),
    (err) => onError?.(err),
  );
}

/**
 * Crea o renombra una rama. `id` es la clave estable (no cambia al renombrar);
 * `label` es el nombre visible.
 * @param {string} id @param {string} label
 * @returns {Promise<void>}
 */
export function saveOrgBranch(id, label) {
  return setDoc(doc(db, 'orgBranches', id), { label, updatedAt: serverTimestamp() }, { merge: true });
}

/** @param {string} id @returns {Promise<void>} */
export function deleteOrgBranch(id) {
  return deleteDoc(doc(db, 'orgBranches', id));
}
