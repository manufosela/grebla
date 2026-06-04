/**
 * Helpers de autenticación (Google OAuth) y gestión del rol admin.
 *
 * @typedef {import('firebase/auth').User} User
 */
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, getDocs, limit, query, collection, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.js';

/**
 * Suscribe a cambios de sesión. Devuelve la función para desuscribirse.
 * @param {(user: User|null) => void} callback
 * @returns {() => void}
 */
export function onUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Usuario actualmente autenticado (o null). @returns {User|null} */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Inicia sesión con Google mediante popup.
 * @returns {Promise<User>}
 */
export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/** Cierra la sesión actual. @returns {Promise<void>} */
export function signOutUser() {
  return signOut(auth);
}

/**
 * Indica si un uid es administrador (existe /admins/{uid}).
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function isAdmin(uid) {
  if (!uid) return false;
  const snapshot = await getDoc(doc(db, 'admins', uid));
  return snapshot.exists();
}

/**
 * Indica si todavía no se ha inicializado ningún administrador.
 * Permite ofrecer el "claim" del primer admin desde la UI.
 * @returns {Promise<boolean>}
 */
export async function isBootstrapAvailable() {
  const initialized = await getDoc(doc(db, 'config', 'adminsInitialized'));
  if (initialized.exists()) return false;
  const anyAdmin = await getDocs(query(collection(db, 'admins'), limit(1)));
  return anyAdmin.empty;
}

/**
 * El primer usuario se reclama como admin (solo si el bootstrap está disponible).
 * Crea /admins/{uid} y marca /config/adminsInitialized de forma atómica.
 * @param {User} user
 * @returns {Promise<void>}
 */
export async function claimFirstAdmin(user) {
  if (!user?.uid) throw new Error('No hay usuario autenticado para reclamar admin.');
  const available = await isBootstrapAvailable();
  if (!available) {
    throw new Error('Ya existe un administrador. Pide a un admin que te dé acceso.');
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'admins', user.uid), {
    email: user.email ?? null,
    createdAt: Date.now(),
  });
  batch.set(doc(db, 'config', 'adminsInitialized'), {
    by: user.uid,
    at: Date.now(),
  });
  await batch.commit();
}
