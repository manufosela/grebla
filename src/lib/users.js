/**
 * Gestión unificada de accesos (pestaña Usuarios del panel de superadmin).
 * Fusiona /admins, /viewers, /leaders en una única lista de usuarios con su
 * rol actual, y permite reasignar el rol de un usuario reescribiendo el doc en
 * la colección correcta y borrando de las otras dos (para que quede en un
 * único rol). Solo puede escribir un superadmin (reglas de Firestore).
 *
 * La lógica pura de fusión/priorización vive en accessRoles.js (sin
 * dependencia de Firestore, testeable sin mocks).
 *
 * @typedef {import('./accessRoles.js').AccessRole} AccessRole
 * @typedef {import('./accessRoles.js').AccessUser} AccessUser
 */
import { doc, collection, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { ROLE_COLLECTION, mergeAccessUsers } from './accessRoles.js';

export { mergeAccessUsers };

/** @returns {Promise<AccessUser[]>} */
export async function listAllUsers() {
  const [usersSnap, adminsSnap, viewersSnap, leadersSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'admins')),
    getDocs(collection(db, 'viewers')),
    getDocs(collection(db, 'leaders')),
  ]);
  const toItems = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return mergeAccessUsers({
    users: toItems(usersSnap),
    superadmin: toItems(adminsSnap),
    viewer: toItems(viewersSnap),
    leader: toItems(leadersSnap),
  });
}

/**
 * Reasigna el rol de acceso de un usuario: escribe el doc en la colección del
 * rol nuevo (con merge, preservando campos existentes como grantedBy) y borra
 * los docs de las otras dos colecciones, de forma que quede en un único rol.
 * `role: 'none'` borra de las tres (quita todo acceso). Solo puede invocarlo
 * un superadmin: las reglas de Firestore rechazan la escritura si no lo es.
 * @param {string} uid
 * @param {AccessRole|'none'} role
 * @param {{ displayName?: string|null, email?: string|null }} [profile]
 * @returns {Promise<void>}
 */
export async function setUserRole(uid, role, profile = {}) {
  const targetCollection = role === 'none' ? null : ROLE_COLLECTION[role];
  const writes = Object.values(ROLE_COLLECTION)
    .filter((collectionName) => collectionName !== targetCollection)
    .map((collectionName) => deleteDoc(doc(db, collectionName, uid)));
  if (targetCollection) {
    writes.push(
      setDoc(
        doc(db, targetCollection, uid),
        { displayName: profile.displayName ?? null, email: profile.email ?? null, addedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  }
  await Promise.all(writes);
}
