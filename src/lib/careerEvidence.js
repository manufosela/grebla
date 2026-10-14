/**
 * Persistencia del historial de expectativas (RMR-TSK-0710) en
 * /people/{personId}/careerEvidence/{autoId}. La lógica vive en
 * src/tools/career/domain/evidence.js; aquí solo se lee y se añade. Las reglas
 * impiden editar o borrar: la evolución no se reescribe.
 *
 * @typedef {import('../tools/career/domain/evidence.js').EvidenceEntry} EvidenceEntry
 */
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { newEntry } from '../tools/career/domain/evidence.js';

const entriesOf = (personId) => collection(db, 'people', personId, 'careerEvidence');

/**
 * Todas las entradas de una persona (de cualquier nivel y expectativa).
 * @param {string} personId
 * @returns {Promise<Array<EvidenceEntry & { id: string }>>}
 */
export async function listEvidence(personId) {
  const snap = await getDocs(entriesOf(personId));
  return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
}

/**
 * Añade una entrada al historial de una expectativa.
 * @param {string} personId
 * @param {{ levelId: string, dimensionId: string, kind: string, text: string,
 *   links?: Array<{ kind: string, url: string }>, by: { uid: string, name: string } }} input
 */
export async function addEvidence(personId, { levelId, dimensionId, kind, text, links = [], by }) {
  const entry = newEntry({ levelId, dimensionId, kind, text, links, by, at: new Date().toISOString() });
  await addDoc(entriesOf(personId), entry);
}
