/**
 * Persistencia de las marcas de expectativas (Mi carrera, RMR-TSK-0678) en
 * /people/{personId}/careerClaims/{levelId}__{dimensionId}. Toda la lógica vive
 * en src/tools/career/domain/claims.js; aquí solo se lee y se escribe. Las
 * reglas (RMR-TSK-0677) garantizan quién escribe qué.
 *
 * @typedef {import('../tools/career/domain/claims.js').Claim} Claim
 * @typedef {{ uid: string, name: string }} Author
 */
import { collection, doc, getDocs, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  claimId, newClaim, resubmitted, reviewPatch, reviewerClaim, reviewerRemark,
} from '../tools/career/domain/claims.js';

const claimsOf = (personId) => collection(db, 'people', personId, 'careerClaims');
const claimDoc = (personId, id) => doc(db, 'people', personId, 'careerClaims', id);
const now = () => new Date().toISOString();

/**
 * Todas las marcas de una persona (de cualquier nivel).
 * @param {string} personId
 * @returns {Promise<Array<Claim & { id: string }>>}
 */
export async function listClaims(personId) {
  const snap = await getDocs(claimsOf(personId));
  return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
}

/**
 * El ingeniero marca una expectativa como cumplida. Si ya había una marca de esa
 * expectativa, la ronda anterior se archiva (reenvío), en una transacción para
 * no perder una revisión que llegue a la vez.
 * @param {string} personId
 * @param {{ levelId: string, dimensionId: string, evidence: { text: string, links?: Array<{ kind: string, url: string }> }, by: Author }} input
 */
export async function submitClaim(personId, { levelId, dimensionId, evidence, by }) {
  const ref = claimDoc(personId, claimId(levelId, dimensionId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const at = now();
    if (snap.exists()) tx.update(ref, resubmitted(snap.data(), { evidence, at, by }));
    else tx.set(ref, newClaim({ levelId, dimensionId, evidence, by, at }));
  });
}

/**
 * El ingeniero retira su marca: la ronda se archiva y la expectativa vuelve a
 * estar abierta.
 * @param {string} personId
 * @param {string} id  id de la marca
 */
export async function withdrawClaim(personId, id) {
  const ref = claimDoc(personId, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Esa marca ya no existe.');
    const current = snap.data();
    tx.update(ref, resubmitted(current, { evidence: current.evidence, at: now(), status: 'withdrawn' }));
  });
}

/**
 * Un revisor acepta o rechaza en su hueco ('first' | 'second' | 'arbiter').
 * @param {string} personId
 * @param {string} id  id de la marca
 * @param {'first'|'second'|'arbiter'} slot
 * @param {{ decision: 'accept'|'reject', reason?: string, by: Author }} input
 */
export async function reviewClaim(personId, id, slot, { decision, reason, by }) {
  await updateDoc(claimDoc(personId, id), reviewPatch(slot, { decision, reason, by, at: now() }));
}

/**
 * Un revisor marca directamente una expectativa sin marca viva (RMR-TSK-0704).
 * Si la persona ya la marcó, lo que toca es revisarla (`reviewClaim`).
 * @param {string} personId
 * @param {{ levelId: string, dimensionId: string, slot: 'first'|'second',
 *   decision: 'accept'|'reject', reason: string, by: Author }} input
 */
export async function markAsReviewer(personId, { levelId, dimensionId, slot, decision, reason, by }) {
  const ref = claimDoc(personId, claimId(levelId, dimensionId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const at = now();
    if (!snap.exists()) {
      tx.set(ref, reviewerClaim({ levelId, dimensionId, slot, decision, reason, by, at }));
      return;
    }
    if (snap.data().status === 'claimed') throw new Error('Esa expectativa ya está marcada: revísala en lugar de marcarla.');
    tx.update(ref, reviewerRemark(snap.data(), { slot, decision, reason, by, at }));
  });
}
