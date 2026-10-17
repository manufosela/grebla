/**
 * Persistencia de los objetivos medibles (RMR-TSK-0750) en
 * /people/{personId}/careerObjectives/{autoId}. La lógica vive en
 * src/tools/career/domain/objectives.js; las reglas (RMR-TSK-0749) deciden quién:
 * los pone y cierra quien lleva a la persona, ella los lee, nadie los borra.
 *
 * @typedef {import('../tools/career/domain/objectives.js').Objective} Objective
 */
import { collection, getDocs, addDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import { newObjective, closeObjective } from '../tools/career/domain/objectives.js';

const objectivesOf = (personId) => collection(db, 'people', personId, 'careerObjectives');

/**
 * @param {string} personId
 * @returns {Promise<Array<Objective & { id: string }>>}
 */
export async function listObjectives(personId) {
  const snap = await getDocs(objectivesOf(personId));
  return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
}

/**
 * @param {string} personId
 * @param {{ title: string, measure: string, dueDate?: string|null, levelId?: string|null,
 *   dimensionId?: string|null, by: { uid: string, name: string } }} input
 */
export async function addObjective(personId, input) {
  await addDoc(objectivesOf(personId), newObjective({ ...input, at: new Date().toISOString() }));
}

/**
 * Cierra un objetivo sobre lo GUARDADO, no sobre la copia de la pantalla: si
 * otra persona ya lo cerró, aquí falla en vez de pisar su resultado.
 * @param {string} personId
 * @param {string} objectiveId
 * @param {'achieved'|'missed'|'dropped'} status
 * @param {string} note
 */
export async function closeObjectiveFor(personId, objectiveId, status, note) {
  const ref = doc(objectivesOf(personId), objectiveId);
  await runTransaction(db, async (tx) => {
    const stored = await tx.get(ref);
    if (!stored.exists()) throw new Error('Este objetivo ya no existe.');
    tx.update(ref, closeObjective(stored.data(), status, note, new Date().toISOString()));
  });
}
