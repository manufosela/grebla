/**
 * Kudos (RMR-PCS-0032 · F1): IO del cliente. El alta SIEMPRE va por la CF
 * submitKudo (ADR de anonimato: el cliente no puede escribir /kudos y ningún
 * doc legible lleva el autor). Lecturas: el muro (todas las personas logadas)
 * y los privados del titular (las reglas los acotan a people.uid == auth.uid).
 *
 * @typedef {Object} WallKudo
 * @property {string} id
 * @property {string} recipientPersonId
 * @property {string} recipientName
 * @property {string} weekKey        Semana ISO (YYYY-Www).
 * @property {string|null} publicText
 * @property {boolean} hasPrivate
 * @property {Date|null} createdAt
 */
import { doc, collection, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from './firebase.js';

/** @param {import('firebase/firestore').DocumentData} d @param {string} id @returns {WallKudo} */
const toKudo = (d, id) => ({
  id,
  recipientPersonId: d.recipientPersonId,
  recipientName: d.recipientName ?? 'Alguien del equipo',
  weekKey: d.weekKey,
  publicText: d.publicText ?? null,
  hasPrivate: Boolean(d.hasPrivate),
  createdAt: d.createdAt?.toDate?.() ?? null,
});

/**
 * Directorio mínimo para el selector: personas activas {personId, name} vía CF
 * (el cliente no puede listar /people).
 * @returns {Promise<{ personId: string, name: string }[]>}
 */
export async function listKudosRecipients() {
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'listKudosRecipients');
  const { data } = await fn();
  return data.people ?? [];
}

/**
 * Da un kudo vía CF (anónimo; valida en servidor).
 * @param {{ recipientPersonId: string, publicText: string|null, privateText: string|null }} input
 * @returns {Promise<{ ok: boolean, kudoId: string }>}
 */
export async function submitKudo(input) {
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'submitKudo');
  const { data } = await fn(input);
  return data;
}

/**
 * Kudos del muro, los más recientes primero (el agrupado semanal lo hace el
 * dominio con groupWallByWeek). Acotado: el muro no es un archivo infinito.
 * @param {number} [max]
 * @returns {Promise<WallKudo[]>}
 */
export async function listWallKudos(max = 400) {
  const snap = await getDocs(query(collection(db, 'kudos'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => toKudo(d.data(), d.id));
}

/**
 * Kudos recibidos por una persona (para «Los míos»), más recientes primero.
 * @param {string} personId
 * @returns {Promise<WallKudo[]>}
 */
export async function listMyKudos(personId) {
  const snap = await getDocs(
    query(collection(db, 'kudos'), where('recipientPersonId', '==', personId), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => toKudo(d.data(), d.id));
}

/**
 * Mensaje privado de un kudo recibido, o null si no lo hay. Solo el titular de
 * la persona destinataria puede leerlo (reglas); para cualquier otro la
 * promesa rechaza con permission-denied.
 * @param {string} kudoId
 * @returns {Promise<string|null>}
 */
export async function getMyPrivateMessage(kudoId) {
  const snap = await getDoc(doc(db, 'kudos', kudoId, 'private', 'message'));
  return snap.exists() ? (snap.data().text ?? null) : null;
}
