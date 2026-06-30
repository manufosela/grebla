/**
 * Líderes de la instancia (modelo multi-leader). Cada líder administra sus
 * personas (con compartición/transferencia entre líderes); los da de alta un
 * superadmin. Viven en /leaders/{uid} con displayName/email para los selectores.
 */
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {{ uid: string, displayName: string|null, email: string|null }} Leader */

/** @param {import('firebase/firestore').DocumentData} data @param {string} uid @returns {Leader} */
const toLeader = (data, uid) => ({
  uid,
  displayName: data.displayName ?? null,
  email: data.email ?? null,
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
 * Alta de un líder por email (lo invoca un superadmin). Usa la Cloud Function
 * manageLeader, que resuelve el email a uid (el usuario debe haber iniciado
 * sesión al menos una vez) y crea /leaders/{uid}.
 * @param {string} email
 * @returns {Promise<{ ok: boolean, uid: string }>}
 */
export async function addLeaderByEmail(email) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'manageLeader')({ action: 'add', email: String(email).trim() });
  return /** @type {any} */ (res.data);
}
