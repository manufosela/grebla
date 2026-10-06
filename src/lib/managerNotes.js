/**
 * Notas privadas del manager sobre una persona (RMR-TSK-0636). Viven en
 * /managerNotes/{personId}/entries, fuera de la ficha: las reglas dejan entrar
 * a su manager y su cadena, y nunca a la propia persona.
 */
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { noteErrors, cleanNote, sortNotes } from '../tools/o2o/domain/managerNotes.js';

const entries = (personId) => collection(db, 'managerNotes', personId, 'entries');

/** Todas las notas de una persona, de la más reciente a la más antigua. */
export async function listManagerNotes(personId) {
  const snap = await getDocs(entries(personId));
  return sortNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

function validated(draft) {
  const errors = noteErrors(draft);
  if (errors.length) throw new Error(errors[0]);
  return cleanNote(draft);
}

/** Alta de una nota. @returns {Promise<string>} su id */
export async function addManagerNote(personId, draft) {
  const by = auth.currentUser?.uid;
  if (!by) throw new Error('Necesitas iniciar sesión.');
  const ref = await addDoc(entries(personId), { ...validated(draft), createdBy: by, createdAt: serverTimestamp() });
  return ref.id;
}

/** Edita una nota existente. */
export function updateManagerNote(personId, id, draft) {
  const by = auth.currentUser?.uid;
  if (!by) throw new Error('Necesitas iniciar sesión.');
  return updateDoc(doc(entries(personId), id), { ...validated(draft), updatedBy: by, updatedAt: serverTimestamp() });
}

/** Borra una nota. */
export function deleteManagerNote(personId, id) {
  return deleteDoc(doc(entries(personId), id));
}
