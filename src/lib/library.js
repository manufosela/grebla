/**
 * Biblioteca de la bodega (RMR-PCS-0033 · F1): IO de /libraryBooks y
 * /libraryRequests. El préstamo vive en el doc del libro (campos borrowedBy… y
 * dueDate);
 * las reglas dejan a cualquier persona logada tocar SOLO esos campos — el
 * catálogo lo curan managers/superadmin. Validación en el dominio
 * (src/tools/library/domain/library.js) antes de llamar aquí.
 *
 * @typedef {Object} LibraryBook
 * @property {string} id
 * @property {string} title
 * @property {string|null} author
 * @property {'physical'|'digital'} format
 * @property {string|null} url             Solo digitales.
 * @property {string[]} topics
 * @property {boolean} recommended
 * @property {boolean} active
 * @property {string|null} borrowedByUid       Uid ANCLADO por reglas al que firma.
 * @property {string|null} borrowedByPersonId
 * @property {string|null} borrowedByName
 * @property {Date|null} borrowedAt
 * @property {string|null} dueDate         ISO YYYY-MM-DD (fecha máxima de devolución).
 *
 * @typedef {Object} LibraryRequest
 * @property {string} id
 * @property {'buy'|'upload'} type
 * @property {string} title
 * @property {string|null} author
 * @property {string|null} reason
 * @property {string|null} requestedByPersonId
 * @property {string} requestedByName
 * @property {'abierta'|'resuelta'} status
 * @property {Date|null} createdAt
 */
import {
  doc,
  collection,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

/** @param {import('firebase/firestore').DocumentData} d @param {string} id @returns {LibraryBook} */
const toBook = (d, id) => ({
  id,
  title: d.title ?? '',
  author: d.author ?? null,
  format: d.format === 'digital' ? 'digital' : 'physical',
  url: d.url ?? null,
  topics: Array.isArray(d.topics) ? d.topics : [],
  recommended: Boolean(d.recommended),
  active: d.active !== false,
  borrowedByUid: d.borrowedByUid ?? null,
  borrowedByPersonId: d.borrowedByPersonId ?? null,
  borrowedByName: d.borrowedByName ?? null,
  borrowedAt: d.borrowedAt?.toDate?.() ?? null,
  dueDate: d.dueDate ?? null,
});

/** @param {import('firebase/firestore').DocumentData} d @param {string} id @returns {LibraryRequest} */
const toRequest = (d, id) => ({
  id,
  type: d.type === 'upload' ? 'upload' : 'buy',
  title: d.title ?? '',
  author: d.author ?? null,
  reason: d.reason ?? null,
  requestedByPersonId: d.requestedByPersonId ?? null,
  requestedByName: d.requestedByName ?? 'Alguien del equipo',
  status: d.status === 'resuelta' ? 'resuelta' : 'abierta',
  createdAt: d.createdAt?.toDate?.() ?? null,
});

/** Estantería completa (activos e inactivos; la UI filtra). @returns {Promise<LibraryBook[]>} */
export async function listBooks() {
  const snap = await getDocs(collection(db, 'libraryBooks'));
  return snap.docs.map((d) => toBook(d.data(), d.id));
}

/**
 * Crea o edita un libro del catálogo (managers/superadmin por reglas).
 * @param {string|null} id  null crea uno nuevo
 * @param {ReturnType<import('../tools/library/domain/library.js').validateBookInput> & { active?: boolean }} book
 * @returns {Promise<string>} id del libro
 */
export async function saveBook(id, book) {
  if (id) {
    await setDoc(doc(db, 'libraryBooks', id), { ...book, updatedAt: serverTimestamp() }, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, 'libraryBooks'), {
    ...book,
    active: true,
    borrowedByPersonId: null,
    borrowedByName: null,
    borrowedAt: null,
    dueDate: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Se lleva un libro: quién lo tiene y hasta cuándo se compromete a devolverlo.
 * Las reglas exigen que el libro esté libre y que `uid` sea el de quien firma.
 * @param {string} bookId
 * @param {{ personId: string, personName: string, dueDate: string }} loan  Validado por validateLoan.
 * @param {string} uid  Uid autenticado (anclado por reglas).
 */
export function borrowBook(bookId, loan, uid) {
  return updateDoc(doc(db, 'libraryBooks', bookId), {
    borrowedByUid: uid,
    borrowedByPersonId: loan.personId,
    borrowedByName: loan.personName,
    borrowedAt: serverTimestamp(),
    dueDate: loan.dueDate,
  });
}

/** Devuelve el libro a la estantería (solo quien lo tiene, por reglas).
 * @param {string} bookId */
export function returnBook(bookId) {
  return updateDoc(doc(db, 'libraryBooks', bookId), {
    borrowedByUid: null,
    borrowedByPersonId: null,
    borrowedByName: null,
    borrowedAt: null,
    dueDate: null,
  });
}

/** @param {string} bookId */
export function deleteBook(bookId) {
  return deleteDoc(doc(db, 'libraryBooks', bookId));
}

/** Peticiones, para la pestaña y su gestión. @returns {Promise<LibraryRequest[]>} */
export async function listRequests() {
  const snap = await getDocs(collection(db, 'libraryRequests'));
  return snap.docs.map((d) => toRequest(d.data(), d.id));
}

/**
 * Pide un libro: comprar (físico) o subir (digital). Las reglas exigen la
 * identidad anclada (requestedByUid == auth.uid) y estado inicial «abierta».
 * @param {ReturnType<import('../tools/library/domain/library.js').validateRequestInput>} request  Validada.
 * @param {{ uid: string, personId: string|null, name: string }} requestedBy
 */
export function submitRequest(request, requestedBy) {
  return addDoc(collection(db, 'libraryRequests'), {
    ...request,
    requestedByUid: requestedBy.uid,
    requestedByPersonId: requestedBy.personId,
    requestedByName: requestedBy.name,
    status: 'abierta',
    createdAt: serverTimestamp(),
  });
}

/** Marca una petición como resuelta (managers/superadmin). @param {string} requestId */
export function resolveRequest(requestId) {
  return updateDoc(doc(db, 'libraryRequests', requestId), { status: 'resuelta' });
}
