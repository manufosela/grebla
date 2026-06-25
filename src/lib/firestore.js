/**
 * Helpers de lectura/escritura en Firestore.
 *
 * Estructura de datos:
 *   /users/{uid}                      Resumen del usuario (para listado admin).
 *   /users/{uid}/sessions/{sessionId} Cada sesión del cuestionario.
 *   /config/org                       Configuración de la organización (fase/pesos).
 *   /admins/{uid}                     Marca de administrador.
 *
 * @typedef {import('./scoring.js').OrgConfig} OrgConfig
 * @typedef {import('../data/items.js').Answers} Answers
 */
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Borra una medición (sesión) de un usuario. Permitido al propio uid o a un
 * admin (ver firestore.rules). Para gestión de datos en el panel admin.
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export function deleteSession(tenantId, uid, sessionId) {
  return deleteDoc(doc(db, 'tenants', tenantId, 'rolemirror', uid, 'sessions', sessionId));
}

/**
 * Borra TODOS los datos de un usuario: sus mediciones (subcolección sessions) y
 * su documento de perfil en el tenant. No borra la cuenta de Auth (se recrea
 * limpia al reentrar). Permitido al propio uid o al tenant-admin (ver firestore.rules).
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function deleteUserData(tenantId, uid) {
  const base = doc(db, 'tenants', tenantId, 'rolemirror', uid);
  const sessions = await getDocs(collection(base, 'sessions'));
  await Promise.all(sessions.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(base);
}

/**
 * Crea un debouncer reutilizable.
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} delayMs
 * @returns {F & { cancel: () => void, flush: () => void }}
 */
export function debounce(fn, delayMs) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {any[]|null} */
  let lastArgs = null;
  const debounced = /** @type {any} */ (
    (/** @type {any[]} */ ...args) => {
      lastArgs = args;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const args2 = lastArgs ?? [];
        lastArgs = null;
        fn(...args2);
      }, delayMs);
    }
  );
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      const args = lastArgs ?? [];
      lastArgs = null;
      fn(...args);
    }
  };
  return debounced;
}

// ── Resumen de usuario (para el panel admin) ───────────────────────────────

/**
 * Crea o actualiza el documento resumen del perfil del usuario en el tenant.
 * @param {string} tenantId
 * @param {{ uid: string, displayName?: string|null, email?: string|null, photoURL?: string|null }} user
 * @param {Object} [summary] Campos agregados (dominantRole, completion, affinities…).
 * @returns {Promise<void>}
 */
export function upsertUserSummary(tenantId, user, summary = {}) {
  return setDoc(
    doc(db, 'tenants', tenantId, 'rolemirror', user.uid),
    {
      uid: user.uid,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      updatedAt: serverTimestamp(),
      ...summary,
    },
    { merge: true },
  );
}

/**
 * Lista los perfiles (resumen) de los miembros del tenant (accesible al
 * tenant-admin según reglas).
 * @param {string} tenantId
 * @returns {Promise<Array<Object>>}
 */
export async function listProfiles(tenantId) {
  const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'rolemirror'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Sesiones ───────────────────────────────────────────────────────────────

/**
 * Crea una nueva sesión vacía y devuelve su id.
 * @param {string} tenantId
 * @param {string} uid
 * @param {{ answers?: Answers, targetRole?: string|null, orgPhase?: string|null }} [initial]
 * @returns {Promise<string>}
 */
export async function createSession(tenantId, uid, initial = {}) {
  const ref = await addDoc(collection(db, 'tenants', tenantId, 'rolemirror', uid, 'sessions'), {
    answers: initial.answers ?? {},
    targetRole: initial.targetRole ?? null,
    orgPhase: initial.orgPhase ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Persiste el estado de una sesión (merge).
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} sessionId
 * @param {{ answers?: Answers, targetRole?: string|null, dominantRole?: string|null, completion?: number, orgPhase?: string|null }} data
 * @returns {Promise<void>}
 */
export function saveSession(tenantId, uid, sessionId, data) {
  return setDoc(
    doc(db, 'tenants', tenantId, 'rolemirror', uid, 'sessions', sessionId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Obtiene una sesión por id.
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getSession(tenantId, uid, sessionId) {
  const snapshot = await getDoc(doc(db, 'tenants', tenantId, 'rolemirror', uid, 'sessions', sessionId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Lista las sesiones de un usuario, de más reciente a más antigua.
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<Array<Object>>}
 */
export async function listSessions(tenantId, uid) {
  const snapshot = await getDocs(
    query(collection(db, 'tenants', tenantId, 'rolemirror', uid, 'sessions'), orderBy('updatedAt', 'desc')),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Configuración de organización ──────────────────────────────────────────

/**
 * Obtiene la configuración activa de la organización (tenant).
 * @param {string} tenantId
 * @returns {Promise<(OrgConfig & { updatedAt?: unknown })|null>}
 */
export async function getOrgConfig(tenantId) {
  const snapshot = await getDoc(doc(db, 'tenants', tenantId, 'config', 'org'));
  return snapshot.exists() ? /** @type {any} */ (snapshot.data()) : null;
}

/**
 * Guarda/actualiza la configuración de la organización (tenant; solo tenant-admin).
 * @param {string} tenantId
 * @param {OrgConfig} config
 * @returns {Promise<void>}
 */
export function saveOrgConfig(tenantId, config) {
  return setDoc(
    doc(db, 'tenants', tenantId, 'config', 'org'),
    { ...config, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
