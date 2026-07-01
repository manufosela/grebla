/**
 * Persistencia del Framework de Carrera a nivel de organización (F1).
 *
 * El framework (el catálogo GLOBAL: tracks, niveles, disciplinas y dimensiones)
 * vive en un único documento Firestore `/careerFramework/engineering`. Lo leen
 * todos los autenticados y solo lo escribe el superadmin (editor del panel
 * /admin, pestaña «Carrera»).
 *
 * Mientras no exista el documento se devuelve el framework en código
 * (`seedFramework`) como semilla/fallback, de modo que funciona desde el primer
 * arranque. Toda la dependencia de Firebase vive SOLO en este módulo; la lógica
 * pura (normalización/serialización) está en src/tools/career/data/framework.js.
 *
 * @typedef {import('../tools/career/data/framework.js').CareerFramework} CareerFramework
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeFramework, serializeFramework } from '../tools/career/data/framework.js';

const CAREER_FRAMEWORK_COLLECTION = 'careerFramework';
const CAREER_FRAMEWORK_DOC = 'engineering';

/** Referencia al documento único del framework. */
const frameworkDoc = () => doc(db, CAREER_FRAMEWORK_COLLECTION, CAREER_FRAMEWORK_DOC);

/**
 * Lee el framework de carrera de la organización. Si el documento no existe
 * todavía, devuelve el framework en código como semilla.
 * @returns {Promise<CareerFramework>}
 */
export async function getFramework() {
  const snap = await getDoc(frameworkDoc());
  return normalizeFramework(snap.exists() ? snap.data() : null);
}

/**
 * Persiste el framework completo (solo superadmin por reglas). Sobrescribe el
 * documento con la versión normalizada (sin `undefined`).
 * @param {CareerFramework} framework
 * @returns {Promise<void>}
 */
export async function saveFramework(framework) {
  await setDoc(
    frameworkDoc(),
    { ...serializeFramework(framework), updatedAt: serverTimestamp() },
    { merge: false },
  );
}
