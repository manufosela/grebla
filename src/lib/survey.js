/**
 * Acceso de cliente a las Cloud Functions de Encuestas (RMR-TSK-0320). La página
 * de respuesta es PÚBLICA (sin login): no toca Firestore directamente —las reglas
 * lo impiden— sino que habla solo con las Cloud Functions, que son las únicas que
 * escriben (Admin SDK). El token del enlace es la credencial.
 */
import { app, db } from './firebase.js';
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

/** Instancia httpsCallable de una función en la región del proyecto. */
async function callable(name) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  return httpsCallable(getFunctions(app, 'europe-west1'), name);
}

// ── Admin de encuestas (solo superadmin; las reglas escriben /surveys directo) ──

/** Crea una encuesta en borrador. @returns {Promise<string>} id */
export async function createSurvey({ title, questions, threshold } = {}) {
  const ref = await addDoc(collection(db, 'surveys'), {
    title: String(title ?? '').trim(),
    questions: questions ?? [],
    threshold: Number.isInteger(threshold) ? threshold : 5,
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

/** Lista todas las encuestas (más recientes primero). Solo superadmin (reglas). */
export async function listSurveys() {
  const snap = await getDocs(query(collection(db, 'surveys'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Una encuesta por id (para el editor). */
export async function getSurveyAdmin(id) {
  const snap = await getDoc(doc(db, 'surveys', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
