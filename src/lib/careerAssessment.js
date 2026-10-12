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
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeLevelAssessment, assertAppendOnlyClosures, closureHistory } from '../tools/career/data/levelAssessment.js';
import { levelProgressFor, subLevelFromProgress } from '../tools/career/domain/levelProgress.js';
import { nextLevelFor } from '../tools/career/domain/subLevel.js';
import { marksFromClaims } from '../tools/career/domain/claims.js';
import { listClaims } from './careerClaims.js';

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

// ── Valoración contra el nivel SIGUIENTE (RMR-PCS-0044 · F2) ────────────────
// Documento por nivel en /people/{personId}/careerAssessments/{levelId}, para
// que las marcas no se reinterpreten contra otro nivel cuando la persona sube.
// Convive con /career/assessment, que responde a otra pregunta («¿cumple el
// nivel que ya tiene?») y por eso no se migra: son dos juicios distintos.
//
// Hereda las reglas del subárbol de la persona, así que escriben los mismos que
// editan su ficha: su manager, su rama (el head) y el superadmin.

/** @param {string} personId @param {string} levelId */
const levelAssessmentDoc = (personId, levelId) => doc(db, 'people', personId, 'careerAssessments', levelId);

/**
 * Lee la valoración de una persona contra un nivel. Sin documento, devuelve una
 * valoración vacía de ese nivel.
 * @param {string} personId @param {string} levelId
 * @returns {Promise<import('../tools/career/data/levelAssessment.js').LevelAssessment>}
 */
export async function getLevelAssessment(personId, levelId) {
  if (!personId || !levelId) throw new Error('getLevelAssessment requiere persona y nivel');
  const snap = await getDoc(levelAssessmentDoc(personId, levelId));
  return normalizeLevelAssessment(snap.exists() ? snap.data() : null, levelId);
}

/**
 * Todas las valoraciones por nivel de una persona, para dibujar su curva
 * (RMR-TSK-0556): una sola lectura en vez de una por nivel del framework.
 * @param {string} personId
 * @returns {Promise<Array<import('../tools/career/data/levelAssessment.js').LevelAssessment>>}
 */
export async function listLevelAssessments(personId) {
  if (!personId) throw new Error('listLevelAssessments requiere persona');
  const snap = await getDocs(collection(db, 'people', personId, 'careerAssessments'));
  return snap.docs.map((d) => normalizeLevelAssessment(d.data(), d.id));
}

/**
 * El sub-nivel efectivo de una persona, leyendo lo que hace falta: la valoración
 * frente al SIGUIENTE nivel (RMR-TSK-0605).
 *
 * Es el único camino para pintar un badge L1-2, y por eso vive aquí y no en cada
 * pantalla: el Seguimiento del plan, la tabla de Personas y Mi Role Mirror leen
 * lo mismo y, por construcción, muestran el mismo número.
 *
 * Ojo con la fuente: el sub-nivel sale de las EXPECTATIVAS cumplidas, no del
 * avance en el mapa de carrera. La formación cuenta otra historia y no mueve el
 * nivel (RMR-PCS-0044).
 *
 * Sin nivel, sin siguiente o sin valoración legible → null, salvo que el manager
 * lo haya ajustado a mano, que aplica igual.
 *
 * @param {{ id: string, levelId?: string|null, careerReviewers?: import('../tools/career/domain/claims.js').Reviewers }} person
 * @param {{ levels?: any[] }|null} framework
 * @returns {Promise<ReturnType<typeof subLevelFromProgress>>}
 */
export async function getPersonSubLevel(person, framework) {
  if (!person?.id || !framework) return null;
  const levelCode = (framework.levels ?? []).find((l) => l.id === person.levelId)?.code ?? null;
  return subLevelFromProgress(person, await getPersonLevelProgress(person, framework), levelCode);
}

/**
 * Avance de una persona hacia su nivel siguiente: el ÚNICO cálculo, que leen
 * Seguimiento, Personas, el O2O y Mi Role Mirror (RMR-TSK-0686). Las marcas son
 * las expectativas ACEPTADAS (Mi carrera); los cierres, los de la valoración del
 * nivel. null sin nivel siguiente o sin expectativas escritas.
 * @param {{ id: string, levelId?: string|null, careerReviewers?: import('../tools/career/domain/claims.js').Reviewers }} person
 * @param {{ levels?: any[] }|null} framework
 */
export async function getPersonLevelProgress(person, framework) {
  if (!person?.id || !framework) return null;
  const next = nextLevelFor(framework.levels ?? [], person.levelId);
  if (!next) return null;
  const [assessment, claims] = await Promise.all([getLevelAssessment(person.id, next.id), listClaims(person.id)]);
  return levelProgressFor({
    person,
    framework,
    marks: marksFromClaims(claims, next.id, person.careerReviewers ?? {}),
    history: closureHistory(assessment),
  });
}

/**
 * Guarda la valoración de un nivel entera (marcas y cierres). Se escribe el
 * documento completo a propósito: los cierres se añaden en el dominio, que es
 * donde está la garantía de que solo crecen.
 * @param {string} personId @param {string} levelId
 * @param {import('../tools/career/data/levelAssessment.js').LevelAssessment} assessment
 * @param {{ uid: string, name: string }|null|undefined} author
 */
export async function saveLevelAssessment(personId, levelId, assessment, author) {
  if (!personId || !levelId) throw new Error('saveLevelAssessment requiere persona y nivel');
  const limpia = normalizeLevelAssessment(assessment, levelId);
  const ref = levelAssessmentDoc(personId, levelId);
  // En transacción y contra lo que hay AHORA en el servidor: los cierres son la
  // prueba de la racha, así que una escritura que los recorte se rechaza aquí
  // —y no en silencio— aunque venga de alguien con permiso para escribir.
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const previa = normalizeLevelAssessment(snap.exists() ? snap.data() : null, levelId);
    assertAppendOnlyClosures(previa.closures, limpia.closures);
    tx.set(ref, {
      levelId,
      byDimension: limpia.byDimension,
      closures: limpia.closures,
      updatedAt: serverTimestamp(),
      updatedBy: author ?? null,
    });
  });
}
