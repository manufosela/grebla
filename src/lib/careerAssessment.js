/**
 * Persistencia Firestore de la VALORACIÓN de una persona frente a las
 * expectativas de su nivel. Vive en /people/{personId}/career/assessment, el
 * mismo subárbol que el journey de carrera, y hereda sus reglas
 * (/people/{personId}/{document=**}: líder dueño / compartido / superadmin).
 *
 * Toda la dependencia de Firebase vive SOLO en este módulo; la lógica pura
 * (filas, puntos de mejora, sugerencia) está en
 * src/tools/career/data/assessment.js.
 *
 * @typedef {import('../tools/career/data/assessment.js').CareerAssessment} CareerAssessment
 * @typedef {import('../tools/career/data/assessment.js').DimensionMark} DimensionMark
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Referencia al documento de valoración de una persona.
 * @param {string} personId
 */
const assessmentDoc = (personId) => doc(db, 'people', personId, 'career', 'assessment');

/**
 * Lee la valoración de una persona. Si el documento no existe todavía, devuelve
 * una valoración vacía (`{ byDimension: {} }`) en lugar de null, para que la UI
 * no tenga que distinguir el caso.
 * @param {string} personId
 * @returns {Promise<CareerAssessment>}
 */
export async function getCareerAssessment(personId) {
  const snap = await getDoc(assessmentDoc(personId));
  if (!snap.exists()) return { byDimension: {} };
  const data = snap.data();
  return { byDimension: data.byDimension ?? {} };
}

/**
 * Guarda (merge) la valoración de una persona. Registra `updatedAt` y el autor
 * del cambio. Nunca escribe `undefined`: si no hay autor, se persiste `null`.
 * @param {string} personId
 * @param {Record<string, DimensionMark>} byDimension  marca por id de dimensión
 * @param {{ uid: string, name: string }|null|undefined} author  autor del cambio (login)
 * @returns {Promise<void>}
 */
export async function saveCareerAssessment(personId, byDimension, author) {
  await setDoc(
    assessmentDoc(personId),
    { byDimension, updatedAt: serverTimestamp(), updatedBy: author ?? null },
    { merge: true },
  );
}
