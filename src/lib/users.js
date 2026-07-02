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
import { doc, collection, addDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { ROLE_COLLECTION, mergeAccessUsers, unlinkedUsers } from './accessRoles.js';

export { mergeAccessUsers, unlinkedUsers };

/**
 * Lista el directorio /users (todos los que han iniciado sesión). Lo usa el
 * líder para ofrecer las cuentas "sin asignar" al vincular una persona (las
 * reglas permiten a superadmin, viewer y líder leer /users).
 * @returns {Promise<Array<{ uid: string, displayName: string|null, email: string|null, lastLogin: unknown }>>}
 */
export async function listUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      displayName: data.displayName ?? null,
      email: data.email ?? null,
      lastLogin: data.lastLogin ?? null,
    };
  });
}

/**
 * uids de cuentas ya vinculadas a una persona (Person.uid no nulo). Solo lo
 * invoca el superadmin, que puede leer todas las personas; el líder deriva sus
 * uids vinculados de las personas que ya tiene cargadas en la tabla.
 * @returns {Promise<string[]>}
 */
export async function listLinkedUids() {
  const snap = await getDocs(collection(db, 'people'));
  return snap.docs
    .map((d) => d.data().uid)
    .filter((uid) => typeof uid === 'string' && uid.length > 0);
}

/**
 * Crea una persona vinculada a un usuario dentro del equipo de un líder. Lo
 * invoca el superadmin desde el panel (las reglas permiten a un superadmin crear
 * personas para cualquier líder). No usa el adapter del líder porque el
 * superadmin no es un líder del container.
 * @param {{ uid: string, displayName?: string|null, email?: string|null }} user  Cuenta a vincular.
 * @param {string} leaderUid  Líder dueño de la persona creada.
 * @returns {Promise<string>}  id de la persona creada.
 */
export async function assignUserToLeader(user, leaderUid) {
  if (!user?.uid) throw new Error('assignUserToLeader requiere el uid del usuario a vincular');
  if (!leaderUid) throw new Error('assignUserToLeader requiere el uid del líder dueño');
  // El nombre visible es lo único que admite un fallback (displayName → email →
  // literal); los datos de vínculo (uid, ownerLeaderUid) nunca son opcionales.
  const name = user.displayName ?? user.email ?? 'Sin nombre';
  const ref = await addDoc(collection(db, 'people'), {
    name,
    uid: user.uid,
    ownerLeaderUid: leaderUid,
    active: true,
    startDate: new Date().toISOString().slice(0, 10),
    guilds: [],
    disciplines: [],
    labels: [],
    githubLogin: null,
  });
  return ref.id;
}

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
