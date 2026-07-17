/**
 * Acceso a las retrospectivas (RMR-TSK-0242). El líder crea/gestiona una retro
 * (/retros/{id}); el equipo aporta notas ANÓNIMAS (/retros/{id}/notes) y vota; de
 * la retro salen acciones (/retroActions) que persisten entre retros hasta
 * cerrarse. Las notas se muestran anónimas (el autor no se expone en la UI) pero
 * guardan authorUid para que cada uno edite/borre las suyas. Los votos son un
 * array `voters` (idempotente, sin voto doble); el recuento = voters.length.
 *
 * La lógica pura de formatos vive en tools/retro/domain/formats.js.
 */
import {
  doc, collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';

// ── Retros ──────────────────────────────────────────────────────────────────

/**
 * Crea una retro (la invoca el líder).
 * @param {{ format: string, name: string, sprint?: string|null, ownerLeaderUid: string,
 *           scope: { type: 'team'|'squad', label?: string|null } }} data
 * @returns {Promise<string>} id de la retro
 */
export async function createRetro(data) {
  if (!data?.ownerLeaderUid) throw new Error('createRetro requiere ownerLeaderUid');
  if (!data?.format) throw new Error('createRetro requiere un formato');
  const ref = await addDoc(collection(db, 'retros'), {
    format: data.format,
    name: data.name ?? '',
    sprint: data.sprint ?? null,
    ownerLeaderUid: data.ownerLeaderUid,
    scope: { type: data.scope?.type ?? 'team', label: data.scope?.label ?? null },
    status: 'open',
    createdAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

/** Retros de un líder, más recientes primero. @param {string} ownerLeaderUid */
export async function listRetros(ownerLeaderUid) {
  const q = query(collection(db, 'retros'), where('ownerLeaderUid', '==', ownerLeaderUid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** @param {string} retroId */
export async function getRetro(retroId) {
  const snap = await getDoc(doc(db, 'retros', retroId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Cierra una retro: deja de admitir aportaciones. @param {string} retroId */
export function closeRetro(retroId) {
  return updateDoc(doc(db, 'retros', retroId), { status: 'closed', closedAt: serverTimestamp() });
}

// ── Notas (anónimas + votos) ─────────────────────────────────────────────────

/** @param {string} retroId @param {string} columnId @param {string} text @param {string} authorUid */
export async function addNote(retroId, columnId, text, authorUid) {
  const ref = await addDoc(collection(db, 'retros', retroId, 'notes'), {
    columnId, text: String(text ?? '').trim(), authorUid, voters: [], createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** @param {string} retroId */
export async function listNotes(retroId) {
  const snap = await getDocs(collection(db, 'retros', retroId, 'notes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** @param {string} retroId @param {string} noteId @param {string} text */
export function editNote(retroId, noteId, text) {
  return updateDoc(doc(db, 'retros', retroId, 'notes', noteId), { text: String(text ?? '').trim() });
}

/** @param {string} retroId @param {string} noteId */
export function deleteNote(retroId, noteId) {
  return deleteDoc(doc(db, 'retros', retroId, 'notes', noteId));
}

/** Vota una nota (idempotente: no cuenta dos veces). @param {string} retroId @param {string} noteId @param {string} uid */
export function voteNote(retroId, noteId, uid) {
  return updateDoc(doc(db, 'retros', retroId, 'notes', noteId), { voters: arrayUnion(uid) });
}

/** Retira el voto. @param {string} retroId @param {string} noteId @param {string} uid */
export function unvoteNote(retroId, noteId, uid) {
  return updateDoc(doc(db, 'retros', retroId, 'notes', noteId), { voters: arrayRemove(uid) });
}

// ── Acciones (con owner, persisten entre retros) ─────────────────────────────

/**
 * @param {{ text: string, owners: string[], ownerLeaderUid: string, fromRetroId: string,
 *           scope: { type: 'team'|'squad', label?: string|null } }} data
 * @returns {Promise<string>}
 */
export async function addAction(data) {
  const ref = await addDoc(collection(db, 'retroActions'), {
    text: String(data.text ?? '').trim(),
    owners: data.owners ?? [],
    ownerNames: data.ownerNames ?? [],
    ownerLeaderUid: data.ownerLeaderUid,
    scope: { type: data.scope?.type ?? 'team', label: data.scope?.label ?? null },
    fromRetroId: data.fromRetroId,
    status: 'pending',
    createdAt: serverTimestamp(),
    doneAt: null,
  });
  return ref.id;
}

/** @param {string} actionId @param {'pending'|'done'} status */
export function setActionStatus(actionId, status) {
  return updateDoc(doc(db, 'retroActions', actionId), {
    status, doneAt: status === 'done' ? serverTimestamp() : null,
  });
}

/** Acciones de una retro concreta. @param {string} retroId */
export async function listRetroActions(retroId) {
  const q = query(collection(db, 'retroActions'), where('fromRetroId', '==', retroId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Acciones pendientes de un líder (para arrastrar a la siguiente retro). @param {string} ownerLeaderUid */
export async function listOpenActions(ownerLeaderUid) {
  const q = query(collection(db, 'retroActions'), where('ownerLeaderUid', '==', ownerLeaderUid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Roster del equipo de un líder ({uid, name} de sus personas con cuenta), para el
 * selector de owner. Solo lo puede leer el propio líder (reglas de /people); el
 * ingeniero ve los nombres de owner denormalizados en cada acción (ownerNames).
 * @param {string} leaderUid
 * @returns {Promise<Array<{ uid: string, name: string }>>}
 */
export async function listTeamMembers(leaderUid) {
  const snap = await getDocs(query(collection(db, 'people'), where('ownerLeaderUid', '==', leaderUid)));
  // La self-ficha del líder cuenta como un miembro más del equipo (RMR-BUG-0041).
  return snap.docs
    .map((d) => ({ uid: d.data().uid, name: d.data().name ?? 'Sin nombre' }))
    .filter((m) => m.uid);
}
