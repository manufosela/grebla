/**
 * Líderes de la instancia (modelo multi-leader). Cada líder administra sus
 * personas (con compartición/transferencia entre líderes); los da de alta un
 * superadmin. Viven en /leaders/{uid} con displayName/email para los selectores.
 */
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {{ uid: string, displayName: string|null, email: string|null, reportsTo: string|null }} Leader */

/** @param {import('firebase/firestore').DocumentData} data @param {string} uid @returns {Leader} */
const toLeader = (data, uid) => ({
  uid,
  displayName: data.displayName ?? null,
  email: data.email ?? null,
  // Jerarquía supermanager (RMR-TSK-0291): EM → Head. null si no reporta a ninguno.
  reportsTo: data.reportsTo ?? null,
});

/** @returns {Promise<Leader[]>} */
export async function listLeaders() {
  const snap = await getDocs(collection(db, 'leaders'));
  return snap.docs.map((d) => toLeader(d.data(), d.id));
}

/** @param {string} uid @returns {Promise<Leader|null>} */
export async function getLeader(uid) {
  const snap = await getDoc(doc(db, 'leaders', uid));
  return snap.exists() ? toLeader(snap.data(), snap.id) : null;
}

/**
 * Alta de un líder por su uid (lo invoca un superadmin o el seed). Requiere el
 * uid real de Auth; el alta por email desde el panel se resuelve con invitación.
 * @param {string} uid
 * @param {{ displayName?: string, email?: string }} [data]
 * @returns {Promise<void>}
 */
export function addLeader(uid, data = {}) {
  return setDoc(
    doc(db, 'leaders', uid),
    { displayName: data.displayName ?? null, email: data.email ?? null, addedAt: serverTimestamp() },
    { merge: true },
  );
}

/** @param {string} uid @returns {Promise<void>} */
export function removeLeader(uid) {
  return deleteDoc(doc(db, 'leaders', uid));
}

/**
 * Supermanagers (Head of X) de la instancia, para el selector de «reporta a»
 * del panel. Viven en /supermanagers/{uid}, legible por cualquier autenticado.
 * @returns {Promise<Array<{ uid: string, displayName: string|null, email: string|null }>>}
 */
export async function listSupermanagers() {
  const snap = await getDocs(collection(db, 'supermanagers'));
  return snap.docs.map((d) => ({
    uid: d.id,
    displayName: d.data().displayName ?? null,
    email: d.data().email ?? null,
  }));
}

/**
 * Asigna (o retira) el Head al que reporta un manager — RMR-TSK-0295. Es lo que
 * define la RAMA del supermanager: las herramientas resuelven su alcance con el
 * cierre transitivo de este campo. Solo lo escribe un superadmin (reglas).
 *
 * `merge: true` para no pisar displayName/email/addedAt; `null` deja al manager
 * fuera de toda rama sin tocar a sus personas.
 * @param {string} uid  manager que reporta
 * @param {string|null} headUid  supermanager al que reporta, o null para quitarlo
 * @returns {Promise<void>}
 */
export function setLeaderReportsTo(uid, headUid) {
  if (headUid === uid) throw new Error('Un manager no puede reportarse a sí mismo.');
  return setDoc(doc(db, 'leaders', uid), { reportsTo: headUid || null }, { merge: true });
}

/**
 * Corrige el nombre visible de un líder (RMR-BUG-0032): al provisionar la
 * cuenta por email antes de su primer login, el nombre cae al propio email
 * (Firebase Auth aún no tiene displayName). Solo toca ese campo — no pisa
 * email/addedAt.
 * @param {string} uid @param {string} displayName
 * @returns {Promise<void>}
 */
export function renameLeader(uid, displayName) {
  return setDoc(doc(db, 'leaders', uid), { displayName: displayName.trim() || null }, { merge: true });
}

/**
 * Alta de un líder por email (lo invoca un superadmin). Usa la Cloud Function
 * manageAccess: resuelve el email a uid o, si nunca ha iniciado sesión,
 * provisiona la cuenta (RMR-TSK-0228) y crea /leaders/{uid}.
 * @param {string} email
 * @returns {Promise<{ ok: boolean, uid: string }>}
 */
export async function addLeaderByEmail(email) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'manageAccess')({ action: 'add', role: 'leader', email: String(email).trim() });
  return /** @type {any} */ (res.data);
}

/**
 * Concede superadmin por email (lo invoca un superadmin), aunque nunca haya
 * iniciado sesión: usa la Cloud Function `grantAdmin`, que provisiona la
 * cuenta si hace falta (mismo patrón que `addLeaderByEmail`).
 * @param {string} email
 * @returns {Promise<{ ok: boolean, uid: string }>}
 */
export async function grantAdminByEmail(email) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'grantAdmin')({ email: String(email).trim() });
  return /** @type {any} */ (res.data);
}
