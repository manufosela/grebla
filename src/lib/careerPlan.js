/**
 * Persistencia del plan de una persona (Mi carrera, RMR-TSK-0687) en
 * /people/{personId}/career/plan. Hereda las reglas del subárbol de la persona:
 * lo escribe su cadena de managers (y el superadmin) y ella lo lee.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizePlan } from '../tools/career/domain/careerPlan.js';

const planDoc = (personId) => doc(db, 'people', personId, 'career', 'plan');

/**
 * @param {string} personId
 * @returns {Promise<import('../tools/career/domain/careerPlan.js').CareerPlan>}
 */
export async function getCareerPlan(personId) {
  const snap = await getDoc(planDoc(personId));
  return normalizePlan(snap.exists() ? snap.data() : null);
}

/**
 * @param {string} personId
 * @param {unknown} plan  borrador; se normaliza antes de guardar
 * @param {{ uid: string, name: string }} author
 */
export async function saveCareerPlan(personId, plan, author) {
  await setDoc(planDoc(personId), { ...normalizePlan(plan), updatedBy: author, updatedAt: serverTimestamp() });
}
