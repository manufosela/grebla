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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.js';

/**
 * Registra la presencia del usuario en /users/{uid} (directorio de quién ha
 * entrado y cuándo, para la pestaña Usuarios del panel). Se escribe como mucho
 * una vez por sesión de pestaña; no bloquea el uso de la app si falla.
 * @param {User} user
 */
async function registerUserPresence(user) {
  try {
    const key = `grebla-presence:${user.uid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    await setDoc(
      doc(db, 'users', user.uid),
      {
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* el registro es best-effort; nunca debe romper el flujo de sesión */
  }
}

// Suscripción global (una por contexto de página): registra al usuario en cuanto
// hay sesión, para que aparezca en el directorio /users aunque aún no tenga rol.
onAuthStateChanged(auth, (user) => {
  if (user) registerUserPresence(user);
});

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
