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
import { doc, collection, addDoc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
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
  const [usersSnap, adminsSnap, supermanagersSnap, viewersSnap, leadersSnap, surveyAdminsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'admins')),
    getDocs(collection(db, 'supermanagers')),
    getDocs(collection(db, 'viewers')),
    getDocs(collection(db, 'leaders')),
    getDocs(collection(db, 'surveyAdmins')),
  ]);
  const toItems = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return mergeAccessUsers({
    users: toItems(usersSnap),
    superadmin: toItems(adminsSnap),
    supermanager: toItems(supermanagersSnap),
    viewer: toItems(viewersSnap),
    leader: toItems(leadersSnap),
    surveyAdmin: toItems(surveyAdminsSnap),
  });
}

/** Colección del eje de gobierno de instancia (superadmin). Se gestiona aparte. */
const ADMIN_COLLECTION = ROLE_COLLECTION.superadmin;

/**
 * Reasigna el ROL DE EQUIPO de un usuario (supermanager/viewer/leader): escribe el
 * doc del rol nuevo y borra los de los otros, de forma que quede en uno solo.
 * `role: 'none'` los borra todos. NO toca el eje de gobierno (superadmin/`/admins`):
 * es ortogonal (ADR de acceso en dos ejes) y se gestiona con `setUserAdmin`, así
 * que cambiar el rol de equipo NO le quita el superadmin. Solo un superadmin puede
 * invocarlo (lo imponen las reglas de Firestore).
 * @param {string} uid
 * @param {AccessRole|'none'} role
 * @param {{ displayName?: string|null, email?: string|null }} [profile]
 * @returns {Promise<void>}
 */
export async function setUserRole(uid, role, profile = {}) {
  // El superadmin es el eje de gobierno, ortogonal: se gestiona con setUserAdmin.
  // Rechazarlo aquí evita que un caller borre el rol de equipo sin conceder admin.
  if (role === 'superadmin') throw new Error('El superadmin se concede con setUserAdmin, no con setUserRole');
  const targetCollection = role === 'none' ? null : ROLE_COLLECTION[role];
  const writes = Object.values(ROLE_COLLECTION)
    .filter((collectionName) => collectionName !== targetCollection && collectionName !== ADMIN_COLLECTION)
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

/**
 * Borra a un usuario que NUNCA ha iniciado sesión (borrado limpio, Fase A). Es
 * seguro porque, sin login, no ha podido generar datos de interacción (sesiones
 * de motivadores, mareas, respuestas…), así que no está en ningún agregado y no
 * hay nada que recalcular. Solo revoca sus roles (equipo + gobierno) y lo saca
 * del directorio /users si por lo que fuera existiera.
 *
 * Comprueba antes las dependencias: si es un líder con personas en su equipo
 * (ownerLeaderUid == uid), FALLA en vez de dejar personas huérfanas.
 *
 * El caller DEBE haber verificado que el usuario nunca inició sesión (lastLogin
 * nulo); esta función no lo puede saber sola. Solo un superadmin puede borrar en
 * esas colecciones (reglas de Firestore).
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function deleteUnusedUser(uid) {
  const owned = await getDocs(query(collection(db, 'people'), where('ownerLeaderUid', '==', uid)));
  if (!owned.empty) {
    const n = owned.size;
    throw new Error(`No se puede borrar: tiene ${n} persona${n === 1 ? '' : 's'} en su equipo. Reasígnalas o bórralas primero.`);
  }
  await setUserRole(uid, 'none'); // borra sus roles de equipo (leaders/viewers/supermanagers)
  await setUserAdmin(uid, false); // y el gobierno (admins)
  await setSurveyAdmin(uid, false); // y el rol de gestor de encuestas (People)
  const usersDoc = doc(db, 'users', uid);
  if ((await getDoc(usersDoc)).exists()) await deleteDoc(usersDoc);
}

/**
 * Concede o retira el GOBIERNO DE INSTANCIA (superadmin) de un usuario ya
 * existente, de forma ORTOGONAL a su rol de equipo (ADR de acceso en dos ejes):
 * solo escribe/borra `/admins/{uid}`, sin tocar sus demás roles. Es lo que
 * alimenta el checkbox «Superadmin» de la lista de usuarios. Solo un superadmin
 * puede escribir en `/admins` (reglas de Firestore).
 * @param {string} uid
 * @param {boolean} isAdmin
 * @param {{ displayName?: string|null, email?: string|null }} [profile]
 * @returns {Promise<void>}
 */
export function setUserAdmin(uid, isAdmin, profile = {}) {
  const ref = doc(db, ADMIN_COLLECTION, uid);
  return isAdmin
    ? setDoc(ref, { displayName: profile.displayName ?? null, email: profile.email ?? null, addedAt: serverTimestamp() }, { merge: true })
    : deleteDoc(ref);
}

/**
 * Concede o retira el rol «gestor de encuestas» (People): puede gestionar
 * /surveys sin ser superadmin. Ortogonal al gobierno y al rol de equipo; solo
 * escribe /surveyAdmins/{uid}. Es lo que alimenta el checkbox «Encuestas» de la
 * lista de usuarios. Solo un superadmin puede escribir (reglas de Firestore).
 * @param {string} uid @param {boolean} isSurveyAdmin
 * @param {{ displayName?: string|null, email?: string|null }} [profile]
 */
export function setSurveyAdmin(uid, isSurveyAdmin, profile = {}) {
  const ref = doc(db, 'surveyAdmins', uid);
  return isSurveyAdmin
    ? setDoc(ref, { displayName: profile.displayName ?? null, email: profile.email ?? null, addedAt: serverTimestamp() }, { merge: true })
    : deleteDoc(ref);
}

/**
 * Corrige el nombre visible de un usuario (lo invoca un superadmin desde la
 * pestaña Usuarios). Escribe /users/{uid}.displayName, que es el que gana en la
 * fusión de la lista (accessRoles.mergeAccessUsers antepone el de /users al del
 * doc de rol). Solo un superadmin puede escribir el /users de otra cuenta
 * (reglas de Firestore). Un nombre vacío vuelve a null.
 * @param {string} uid @param {string} displayName
 * @returns {Promise<void>}
 */
export function setUserDisplayName(uid, displayName) {
  return setDoc(doc(db, 'users', uid), { displayName: displayName.trim() || null }, { merge: true });
}
