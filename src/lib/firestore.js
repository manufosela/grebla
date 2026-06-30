/**
 * Helpers de lectura/escritura en Firestore.
 *
 * Estructura de datos (modelo multi-leader; la persona vive a nivel de instancia):
 *   /people/{personId}/rolemirror/summary               Resumen del perfil (listado admin).
 *   /people/{personId}/rolemirror/summary/sessions/{sessionId}  Cada sesión.
 *   /config/org                                          Configuración de la organización (fase/pesos).
 *   /leaders/{uid}                                       Líderes de la instancia (identidad).
 *   /admins/{uid}                                        Superadmin de la instancia.
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

// ── Role Mirror por PERSONA (heteroevaluación: el líder lo rellena) ──────────
// La persona vive a nivel de instancia; su Role Mirror cuelga de ella:
//   /people/{personId}/rolemirror/summary                 (perfil)
//   /people/{personId}/rolemirror/summary/sessions/{id}
/** Doc resumen Role Mirror de una persona. */
const rmSummaryDoc = (personId) =>
  doc(db, 'people', personId, 'rolemirror', 'summary');
/** Colección de sesiones Role Mirror de una persona. */
const rmSessionsCol = (personId) =>
  collection(db, 'people', personId, 'rolemirror', 'summary', 'sessions');

/**
 * Borra una medición (sesión) de una persona.
 * @param {string} tenantId @param {string} personId @param {string} sessionId
 * @returns {Promise<void>}
 */
export function deleteSession(personId, sessionId) {
  return deleteDoc(doc(rmSessionsCol(personId), sessionId));
}

/**
 * Borra TODO el Role Mirror de una persona: sus mediciones y su resumen.
 * @param {string} tenantId @param {string} personId
 * @returns {Promise<void>}
 */
export async function deleteUserData(personId) {
  const sessions = await getDocs(rmSessionsCol(personId));
  await Promise.all(sessions.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(rmSummaryDoc(personId));
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
 * Crea o actualiza el resumen del Role Mirror de una persona (lo rellena el líder).
 * @param {string} tenantId @param {string} personId
 * @param {Object} [summary] dominantRole, completion, affinities, lastSessionId…
 * @returns {Promise<void>}
 */
export function upsertUserSummary(personId, summary = {}) {
  return setDoc(
    rmSummaryDoc(personId),
    { personId, updatedAt: serverTimestamp(), ...summary },
    { merge: true },
  );
}

/**
 * Lee el resumen del Role Mirror de una persona (o null).
 * @param {string} tenantId @param {string} personId
 * @returns {Promise<Object|null>}
 */
export async function getPersonProfile(personId) {
  const snap = await getDoc(rmSummaryDoc(personId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Sesiones ───────────────────────────────────────────────────────────────

/**
 * Crea una nueva sesión vacía y devuelve su id.
 * @param {string} tenantId
 * @param {string} uid
 * @param {{ answers?: Answers, targetRole?: string|null, orgPhase?: string|null }} [initial]
 * @returns {Promise<string>}
 */
export async function createSession(personId, initial = {}) {
  const ref = await addDoc(rmSessionsCol(personId), {
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
export function saveSession(personId, sessionId, data) {
  return setDoc(
    doc(rmSessionsCol(personId), sessionId),
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
export async function getSession(personId, sessionId) {
  const snapshot = await getDoc(doc(rmSessionsCol(personId), sessionId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Lista las sesiones de un usuario, de más reciente a más antigua.
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<Array<Object>>}
 */
export async function listSessions(personId) {
  const snapshot = await getDocs(query(rmSessionsCol(personId), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Configuración de organización ──────────────────────────────────────────

/**
 * Obtiene la configuración activa de la organización (instancia).
 * @returns {Promise<(OrgConfig & { updatedAt?: unknown })|null>}
 */
export async function getOrgConfig() {
  const snapshot = await getDoc(doc(db, 'config', 'org'));
  return snapshot.exists() ? /** @type {any} */ (snapshot.data()) : null;
}

/**
 * Guarda/actualiza la configuración de la organización (instancia; solo superadmin).
 * @param {OrgConfig} config
 * @returns {Promise<void>}
 */
export function saveOrgConfig(config) {
  return setDoc(
    doc(db, 'config', 'org'),
    { ...config, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
