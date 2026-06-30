/**
 * Helpers de lectura/escritura en Firestore.
 *
 * Estructura de datos (Role Mirror vive por tenant):
 *   /tenants/{tid}/rolemirror/{uid}                      Resumen del perfil (listado admin).
 *   /tenants/{tid}/rolemirror/{uid}/sessions/{sessionId} Cada sesión del cuestionario.
 *   /tenants/{tid}/config/org                            Configuración del tenant (fase/pesos).
 *   /admins/{uid}                                        Marca de super-admin de plataforma.
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
// La persona vive a nivel organización (RMR-TSK-0068); su Role Mirror cuelga de ella:
//   /tenants/{tid}/people/{personId}/rolemirror/summary                 (perfil)
//   /tenants/{tid}/people/{personId}/rolemirror/summary/sessions/{id}
/** Doc resumen Role Mirror de una persona. */
const rmSummaryDoc = (tid, personId) =>
  doc(db, 'tenants', tid, 'people', personId, 'rolemirror', 'summary');
/** Colección de sesiones Role Mirror de una persona. */
const rmSessionsCol = (tid, personId) =>
  collection(db, 'tenants', tid, 'people', personId, 'rolemirror', 'summary', 'sessions');

/**
 * Borra una medición (sesión) de una persona.
 * @param {string} tenantId @param {string} personId @param {string} sessionId
 * @returns {Promise<void>}
 */
export function deleteSession(tenantId, personId, sessionId) {
  return deleteDoc(doc(rmSessionsCol(tenantId, personId), sessionId));
}

/**
 * Borra TODO el Role Mirror de una persona: sus mediciones y su resumen.
 * @param {string} tenantId @param {string} personId
 * @returns {Promise<void>}
 */
export async function deleteUserData(tenantId, personId) {
  const sessions = await getDocs(rmSessionsCol(tenantId, personId));
  await Promise.all(sessions.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(rmSummaryDoc(tenantId, personId));
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
export function upsertUserSummary(tenantId, personId, summary = {}) {
  return setDoc(
    rmSummaryDoc(tenantId, personId),
    { personId, updatedAt: serverTimestamp(), ...summary },
    { merge: true },
  );
}

/**
 * Lee el resumen del Role Mirror de una persona (o null).
 * @param {string} tenantId @param {string} personId
 * @returns {Promise<Object|null>}
 */
export async function getPersonProfile(tenantId, personId) {
  const snap = await getDoc(rmSummaryDoc(tenantId, personId));
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
export async function createSession(tenantId, personId, initial = {}) {
  const ref = await addDoc(rmSessionsCol(tenantId, personId), {
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
export function saveSession(tenantId, personId, sessionId, data) {
  return setDoc(
    doc(rmSessionsCol(tenantId, personId), sessionId),
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
export async function getSession(tenantId, personId, sessionId) {
  const snapshot = await getDoc(doc(rmSessionsCol(tenantId, personId), sessionId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/**
 * Lista las sesiones de un usuario, de más reciente a más antigua.
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<Array<Object>>}
 */
export async function listSessions(tenantId, personId) {
  const snapshot = await getDocs(query(rmSessionsCol(tenantId, personId), orderBy('updatedAt', 'desc')));
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
