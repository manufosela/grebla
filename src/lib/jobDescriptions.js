/**
 * Job Descriptions (RMR-PCS-0031 · F3): IO de /jobDescriptions. Solo el
 * superadmin lee/escribe (reglas); el público consume la URL /jd/{id} servida
 * por la CF «jd» (solo docs publicadas). El payload guardado es el JSON-LD
 * generado por el dominio (generateJobDescription) y validado antes de guardar.
 *
 * @typedef {Object} JdRecord
 * @property {string} id
 * @property {'borrador'|'publicada'} status
 * @property {string} roleName
 * @property {string[]} levelIds
 * @property {string[]} disciplineIds
 * @property {string} descriptionIntro
 * @property {string} datePosted
 * @property {Record<string, unknown>} payload   El JSON-LD conforme al contrato.
 * @property {Date|null} publishedAt
 */
import { doc, collection, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from './firebase.js';

/**
 * Pulido IA de los ítems deterministas (RMR-TSK-0418): Haiku corrige SOLO
 * gramática/concordancia con barandillas en servidor. Lanza si la instancia no
 * tiene IA configurada — el caller decide el fallback (guardar determinista
 * con aviso, nunca en silencio).
 * @param {{ responsibilities: string[], niceToHave: string[], month3: string }} input
 * @returns {Promise<{ responsibilities: string[], niceToHave: string[], month3: string, changed: number }>}
 */
export async function polishJdRequirements(input) {
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'polishJdRequirements');
  const { data } = await fn(input);
  return data;
}

/** @param {import('firebase/firestore').DocumentData} d @param {string} id @returns {JdRecord} */
const toJd = (d, id) => ({
  id,
  status: d.status === 'publicada' ? 'publicada' : 'borrador',
  roleName: d.roleName ?? '',
  levelIds: Array.isArray(d.levelIds) ? d.levelIds : [],
  disciplineIds: Array.isArray(d.disciplineIds) ? d.disciplineIds : [],
  descriptionIntro: d.descriptionIntro ?? '',
  datePosted: d.datePosted ?? '',
  payload: d.payload ?? null,
  publishedAt: d.publishedAt?.toDate?.() ?? null,
});

/** Todas las JDs (panel superadmin). @returns {Promise<JdRecord[]>} */
export async function listJds() {
  const snap = await getDocs(collection(db, 'jobDescriptions'));
  return snap.docs.map((d) => toJd(d.data(), d.id));
}

/**
 * Crea/actualiza una JD (params + payload generado). No cambia el status si ya
 * existe (editar una publicada la deja publicada con el payload nuevo).
 * @param {string} id
 * @param {Omit<JdRecord, 'id'|'publishedAt'|'status'> & { status?: 'borrador'|'publicada' }} jdRecord
 */
export function saveJd(id, jdRecord) {
  return setDoc(doc(db, 'jobDescriptions', id), { ...jdRecord, updatedAt: serverTimestamp() }, { merge: true });
}

/** Publica la JD: visible en /jd/{id}. */
export function publishJd(id) {
  return setDoc(doc(db, 'jobDescriptions', id), { status: 'publicada', publishedAt: serverTimestamp() }, { merge: true });
}

/** Despublica: /jd/{id} pasa a responder 404 controlado. */
export function unpublishJd(id) {
  return setDoc(doc(db, 'jobDescriptions', id), { status: 'borrador' }, { merge: true });
}

/** @param {string} id */
export function deleteJd(id) {
  return deleteDoc(doc(db, 'jobDescriptions', id));
}
