/**
 * Acceso de cliente a las Cloud Functions de Encuestas (RMR-TSK-0320). La página
 * de respuesta es PÚBLICA (sin login): no toca Firestore directamente —las reglas
 * lo impiden— sino que habla solo con las Cloud Functions, que son las únicas que
 * escriben (Admin SDK). El token del enlace es la credencial.
 */
import { app } from './firebase.js';

/** Instancia httpsCallable de una función en la región del proyecto. */
async function callable(name) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  return httpsCallable(getFunctions(app, 'europe-west1'), name);
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
