/**
 * Acceso de cliente a las Cloud Functions de Encuestas (RMR-TSK-0320). La página
 * de respuesta es PÚBLICA (sin login): no toca Firestore directamente —las reglas
 * lo impiden— sino que habla solo con las Cloud Functions, que son las únicas que
 * escriben (Admin SDK). El token del enlace es la credencial.
 */
import { app, db } from './firebase.js';
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

/** Instancia httpsCallable de una función en la región del proyecto. */
async function callable(name) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  return httpsCallable(getFunctions(app, 'europe-west1'), name);
}

// ── Admin de encuestas (solo superadmin; las reglas escriben /surveys directo) ──

/** Crea una encuesta en borrador. @returns {Promise<string>} id */
export async function createSurvey({ title, questions, threshold, defaultScale, email, layout } = {}) {
  const ref = await addDoc(collection(db, 'surveys'), {
    title: String(title ?? '').trim(),
    questions: questions ?? [],
    threshold: Number.isInteger(threshold) ? threshold : 5,
    defaultScale: defaultScale ?? { min: 1, max: 5 },
    email: email ?? { subject: '', body: '' },
    layout: layout ?? {},
    status: 'draft',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Aplica un parche a una encuesta (título, preguntas, umbral…). */
export function updateSurvey(id, patch) {
  return updateDoc(doc(db, 'surveys', id), patch);
}

/** Cambia el estado (draft → open → closed). */
export function setSurveyStatus(id, status) {
  return updateDoc(doc(db, 'surveys', id), { status });
}

/**
 * Borra una encuesta y, en cascada, sus tokens y respuestas. Vía Cloud Function
 * (Admin SDK); solo superadmin. El cliente no puede borrar /surveys ni sus
 * subcolecciones (las reglas lo impiden).
 */
export async function deleteSurvey(id) {
  const fn = await callable('deleteSurvey');
  await fn({ surveyId: id });
}

// ── Biblioteca de plantillas (/surveyTemplates) — solo superadmin/People ──

const TEMPLATES = 'surveyTemplates';

/** Plantillas guardadas, ordenadas por nombre. */
export async function listSurveyTemplates() {
  const snap = await getDocs(query(collection(db, TEMPLATES), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Guarda un conjunto de preguntas como plantilla con nombre. @returns {Promise<string>} id */
export async function saveSurveyTemplate(name, questions) {
  const ref = await addDoc(collection(db, TEMPLATES), {
    name: String(name ?? '').trim(),
    questions: questions ?? [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Renombra una plantilla. */
export function renameSurveyTemplate(id, name) {
  return updateDoc(doc(db, TEMPLATES, id), { name: String(name ?? '').trim() });
}

/** Sustituye las preguntas de una plantilla (editar). */
export function updateSurveyTemplate(id, questions) {
  return updateDoc(doc(db, TEMPLATES, id), { questions: questions ?? [] });
}

/** Borra una plantilla. */
export function deleteSurveyTemplate(id) {
  return deleteDoc(doc(db, TEMPLATES, id));
}

/** Lista todas las encuestas (más recientes primero). Solo superadmin (reglas). */
export async function listSurveys() {
  const snap = await getDocs(query(collection(db, 'surveys'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ¿La encuesta tiene alguna respuesta? (para permitir borrarla solo si no). Solo superadmin. */
export async function surveyHasResponses(surveyId) {
  const snap = await getDocs(query(collection(db, 'surveys', surveyId, 'answers'), limit(1)));
  return !snap.empty;
}

/** Una encuesta por id (para el editor). */
export async function getSurveyAdmin(id) {
  const snap = await getDoc(doc(db, 'surveys', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Genera un token por participante (vía Cloud Function; reutiliza el existente
 * por email). @returns {Promise<Array<{ email: string, token: string }>>}
 */
export async function createSurveyTokens(surveyId, participants) {
  const fn = await callable('createSurveyTokens');
  const res = await fn({ surveyId, participants });
  return res.data?.tokens ?? [];
}

/**
 * Envía un correo de PRUEBA a `to` con un enlace de prueba (su respuesta no cuenta).
 * La URL de la instancia la compone el servidor (no se manda desde el cliente).
 */
export async function sendSurveyTestEmail(surveyId, to) {
  const fn = await callable('sendSurveyTestEmail');
  const { data } = await fn({ surveyId, to });
  return data;
}

/** Envío MASIVO: manda a cada participante su enlace. @returns {Promise<{sent,failed}>} */
export async function sendSurveyBulkEmails(surveyId) {
  const fn = await callable('sendSurveyBulkEmails');
  const res = await fn({ surveyId });
  return res.data ?? { sent: 0, failed: 0 };
}

/**
 * Reinicia las respuestas de una encuesta para relanzarla: borra respuestas y deja
 * los tokens como pendientes, manteniendo los enlaces. Con `onlyTest`, solo las de
 * prueba. @returns {Promise<{cleared:number, tokensReset:number}>}
 */
export async function resetSurveyResponses(surveyId, onlyTest = false) {
  const fn = await callable('resetSurveyResponses');
  const res = await fn({ surveyId, onlyTest });
  return res.data ?? { cleared: 0, tokensReset: 0 };
}

/** Actualiza los campos de segmentación de un participante (por token), sin regenerar el enlace. */
export async function updateSurveyParticipant(surveyId, token, metadata) {
  const fn = await callable('updateSurveyParticipant');
  await fn({ surveyId, token, metadata });
}

/** Borra un participante (su token) y su respuesta si la hubiera. */
export async function deleteSurveyParticipant(surveyId, token) {
  const fn = await callable('deleteSurveyParticipant');
  await fn({ surveyId, token });
}

/** Tokens (padrón) de una encuesta, para participación y reenvío. Solo superadmin. */
export async function listTokens(surveyId) {
  const snap = await getDocs(collection(db, 'surveys', surveyId, 'tokens'));
  return snap.docs.map((d) => ({ token: d.id, ...d.data() }));
}

/** Respuestas ANÓNIMAS de una encuesta (para los dashboards). Solo superadmin/gestor. */
export async function listAnswers(surveyId) {
  const snap = await getDocs(collection(db, 'surveys', surveyId, 'answers'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ¿Es `uid` gestor de encuestas (People)? Para abrir la tool sin ser superadmin. */
export async function isSurveyAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'surveyAdmins', uid));
  return snap.exists();
}

/**
 * Da de alta un «People account» por email (provisiona la cuenta si nunca inició
 * sesión y le concede el rol), vía la Cloud Function manageAccess. Solo superadmin.
 */
export async function addSurveyAdminByEmail(email) {
  const fn = await callable('manageAccess');
  const res = await fn({ action: 'add', role: 'surveyAdmin', email: String(email ?? '').trim() });
  return res.data;
}

/**
 * Carga la encuesta abierta de un token y las respuestas previas (para editar).
 * @param {string} surveyId @param {string} token
 * @returns {Promise<{ survey: { title: string, questions: Array<object> }, responses: Record<string, unknown>|null }>}
 */
export async function getSurveyForToken(surveyId, token) {
  const fn = await callable('getSurveyForToken');
  const res = await fn({ surveyId, token });
  return res.data;
}

/**
 * Guarda (o sobrescribe) la respuesta anónima. Reenviar edita la misma hasta el
 * cierre de la encuesta.
 * @param {string} surveyId @param {string} token @param {Record<string, unknown>} responses
 * @returns {Promise<{ ok: boolean }>}
 */
export async function submitSurveyResponse(surveyId, token, responses) {
  const fn = await callable('submitSurveyResponse');
  const res = await fn({ surveyId, token, responses });
  return res.data;
}
