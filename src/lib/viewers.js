/**
 * Viewers de la instancia (rol de solo lectura, tipo C-level). Ven el panel de
 * gestión (líderes, catálogos, mapa de carrera) igual que el superadmin, pero
 * sin poder escribir nada. Los da de alta un superadmin. Viven en
 * /viewers/{uid} con displayName/email, mismo patrón que /leaders/{uid}.
 */
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {{ uid: string, displayName: string|null, email: string|null }} Viewer */

/** @param {import('firebase/firestore').DocumentData} data @param {string} uid @returns {Viewer} */
const toViewer = (data, uid) => ({
  uid,
  displayName: data.displayName ?? null,
  email: data.email ?? null,
});

/** @returns {Promise<Viewer[]>} */
export async function listViewers() {
  const snap = await getDocs(collection(db, 'viewers'));
  return snap.docs.map((d) => toViewer(d.data(), d.id));
}

/** @param {string} uid @returns {Promise<Viewer|null>} */
export async function getViewer(uid) {
  const snap = await getDoc(doc(db, 'viewers', uid));
  return snap.exists() ? toViewer(snap.data(), snap.id) : null;
}

/**
 * Alta de un viewer por su uid (lo invoca un superadmin o el seed). Requiere el
 * uid real de Auth; el alta por email desde el panel se resuelve con invitación.
 * @param {string} uid
 * @param {{ displayName?: string, email?: string }} [data]
 * @returns {Promise<void>}
 */
export function addViewer(uid, data = {}) {
  return setDoc(
    doc(db, 'viewers', uid),
    { displayName: data.displayName ?? null, email: data.email ?? null, addedAt: serverTimestamp() },
    { merge: true },
  );
}

/** @param {string} uid @returns {Promise<void>} */
export function removeViewer(uid) {
  return deleteDoc(doc(db, 'viewers', uid));
}

/**
 * Alta de un viewer por email (lo invoca un superadmin). Usa la Cloud Function
 * manageAccess, que resuelve el email a uid (el usuario debe haber iniciado
 * sesión al menos una vez) y crea /viewers/{uid}.
 * @param {string} email
 * @returns {Promise<{ ok: boolean, uid: string }>}
 */
export async function addViewerByEmail(email) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'manageAccess')({ action: 'add', role: 'viewer', email: String(email).trim() });
  return /** @type {any} */ (res.data);
}
