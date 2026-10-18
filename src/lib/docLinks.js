/**
 * Enlaces de Documentación (RMR-TSK-0778) en la colección docLinks. La lógica
 * vive en src/tools/docs/domain/docLinks.js; las reglas deciden quién: los lee
 * cualquiera con sesión y los gestiona quien gestiona Documentación.
 *
 * @typedef {import('../tools/docs/domain/docLinks.js').DocLink} DocLink
 */
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase.js';
import { newDocLink } from '../tools/docs/domain/docLinks.js';

const linksCol = () => collection(db, 'docLinks');

/** @returns {Promise<Array<DocLink & { id: string }>>} */
export async function listDocLinks() {
  const snap = await getDocs(linksCol());
  return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
}

/** @param {Partial<DocLink>} input */
export async function addDocLink(input) {
  await addDoc(linksCol(), newDocLink(/** @type {any} */ (input)));
}

/** @param {string} id @param {Partial<DocLink>} input */
export async function updateDocLink(id, input) {
  await updateDoc(doc(linksCol(), id), newDocLink(/** @type {any} */ (input)));
}

/** @param {string} id */
export async function removeDocLink(id) {
  await deleteDoc(doc(linksCol(), id));
}
