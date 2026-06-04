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
import { doc, getDoc } from 'firebase/firestore';
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

// El alta de administradores se hace SOLO server-side (Admin SDK / script de
// seed / Cloud Function `grantAdmin`). No existe ningún mecanismo cliente para
// auto-concederse admin: sería un agujero de seguridad.
