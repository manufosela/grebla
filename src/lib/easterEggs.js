/**
 * Huevos de pascua (RMR-PCS-0030): IO de /easterEggs. El doc del huevo lo lee
 * cualquier autenticado (el juego lo renderiza); la gestión es de superadmin
 * (reglas). Los HALLAZGOS los escribe SOLO la Cloud Function registerEggFind
 * (timestamp de servidor, idempotente); aquí solo se leen (tabla del editor).
 *
 * @typedef {Object} EasterEgg
 * @property {string} id
 * @property {'objeto-isla'|'clic-en-casa'} type
 * @property {boolean} active
 * @property {string} title
 * @property {string} instructions  El reto/pistas que ve quien lo encuentra.
 * @property {string} prize         Descripción del premio.
 * @property {string|null} islandId Isla (tipo objeto; también la de la casa).
 * @property {string|null} cityId   Casa (tipo clic-en-casa).
 * @property {number} x             Posición en la isla 0..100 (tipo objeto).
 * @property {number} y
 * @property {boolean} hasSecret    Si el reto exige palabra clave (el valor vive en private).
 */
import { doc, collection, getDocs, getDoc, setDoc, deleteDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, getRegionalFunctions } from './firebase.js';

/** @param {import('firebase/firestore').DocumentData} d @param {string} id @returns {EasterEgg} */
const toEgg = (d, id) => ({
  id,
  type: d.type === 'clic-en-casa' ? 'clic-en-casa' : 'objeto-isla',
  active: d.active === true,
  title: d.title ?? '',
  instructions: d.instructions ?? '',
  prize: d.prize ?? '',
  islandId: d.islandId ?? null,
  cityId: d.cityId ?? null,
  x: Number.isFinite(d.x) ? d.x : 50,
  y: Number.isFinite(d.y) ? d.y : 20,
  hasSecret: d.hasSecret === true,
});

/** Huevos ACTIVOS (para el juego). @returns {Promise<EasterEgg[]>} */
export async function listActiveEggs() {
  const snap = await getDocs(query(collection(db, 'easterEggs'), where('active', '==', true)));
  return snap.docs.map((d) => toEgg(d.data(), d.id));
}

/** Todos los huevos (editor, superadmin). @returns {Promise<EasterEgg[]>} */
export async function listEggs() {
  const snap = await getDocs(collection(db, 'easterEggs'));
  return snap.docs.map((d) => toEgg(d.data(), d.id));
}

/**
 * Crea/actualiza un huevo (superadmin). `hasSecret` refleja si hay palabra
 * clave; el VALOR se guarda aparte con saveEggSecret (subdoc private).
 * @param {string} id @param {Omit<EasterEgg, 'id'>} egg
 */
export function saveEgg(id, egg) {
  return setDoc(doc(db, 'easterEggs', id), { ...egg, updatedAt: serverTimestamp() }, { merge: true });
}

/** @param {string} id */
export function deleteEgg(id) {
  return deleteDoc(doc(db, 'easterEggs', id));
}

/** Guarda la palabra clave del reto (subdoc private, ilegible para jugadores). */
export function saveEggSecret(id, word) {
  return setDoc(doc(db, 'easterEggs', id, 'private', 'secret'), { word: word ?? '' });
}

/**
 * Guarda huevo + palabra clave de forma ATÓMICA (un batch): o se persisten los
 * dos o ninguno — sin estados a medias entre el doc y su private/secret.
 * @param {string} id @param {Omit<EasterEgg, 'id'>} egg @param {string} word
 */
export function saveEggWithSecret(id, egg, word) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'easterEggs', id), { ...egg, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'easterEggs', id, 'private', 'secret'), { word: word ?? '' });
  return batch.commit();
}

/** Lee la palabra clave (solo superadmin; para precargar el editor). */
export async function getEggSecret(id) {
  const snap = await getDoc(doc(db, 'easterEggs', id, 'private', 'secret'));
  return snap.exists() ? (snap.data().word ?? '') : '';
}

/**
 * Hallazgos de un huevo (superadmin): quién y cuándo (y si resolvió la palabra).
 * @param {string} id
 * @returns {Promise<Array<{personId: string, name: string, foundAt: Date|null, solved: boolean, solvedAt: Date|null}>>}
 */
export async function listEggFinds(id) {
  const snap = await getDocs(collection(db, 'easterEggs', id, 'finds'));
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        personId: d.id,
        name: v.name ?? d.id,
        foundAt: v.foundAt?.toDate?.() ?? null,
        solved: v.solved === true,
        solvedAt: v.solvedAt?.toDate?.() ?? null,
      };
    })
    .toSorted((a, b) => (a.foundAt?.getTime() ?? 0) - (b.foundAt?.getTime() ?? 0));
}

/**
 * Registra el hallazgo (y opcionalmente valida la palabra clave) vía CF.
 * @param {string} eggId @param {string} [secretWord]
 * @returns {Promise<{ok: boolean, already: boolean, solved: boolean, wordError: boolean, foundAt: string|null}>}
 */
export async function registerEggFind(eggId, secretWord) {
  const fn = httpsCallable(await getRegionalFunctions(), 'registerEggFind');
  const res = await fn(secretWord ? { eggId, secretWord } : { eggId });
  return res.data;
}
