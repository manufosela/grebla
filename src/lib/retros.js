/**
 * Acceso a las retrospectivas (RMR-TSK-0242). El líder crea/gestiona una retro
 * (/retros/{id}); el equipo aporta notas (/retros/{id}/notes) y vota; de
 * la retro salen acciones (/retroActions) que persisten entre retros hasta
 * cerrarse. Las notas se muestran anónimas MIENTRAS su zona esté oculta y se
 * firman al revelarla (RMR-TSK-0285); guardan authorUid para que cada uno
 * edite/borre las suyas. Los votos son un array `voters` (idempotente, sin voto
 * doble); el recuento = voters.length.
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
 *           scope: { type: 'team'|'squad', squadId?: string|null, label?: string|null } }} data
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
    // `squadId` referencia el catálogo /squads (RMR-TSK-0278); `label` se
    // conserva por las retros/acciones antiguas, con el squad como texto libre.
    scope: {
      type: data.scope?.type ?? 'team',
      squadId: data.scope?.squadId ?? null,
      label: data.scope?.label ?? null,
    },
    status: 'open',
    // Zonas reveladas por quien facilita (RMR-TSK-0283). Arranca vacío: las
    // tarjetas nacen ocultas para que nadie copie ni se ancle en lo ya escrito.
    revealed: {},
    createdAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

/**
 * Revela u oculta zonas de una retro (RMR-TSK-0283). Recibe lo que devuelve
 * `revealPatch` del dominio: claves `revealed.<columnId>`.
 * Solo lo puede hacer el líder dueño (o un superadmin): lo imponen las reglas.
 * @param {string} retroId
 * @param {Record<string, boolean>} patch
 */
export function setRetroReveal(retroId, patch) {
  return updateDoc(doc(db, 'retros', retroId), patch);
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

/**
 * Borra una retro y SUS NOTAS (RMR-TSK-0280).
 *
 * Firestore NO borra las subcolecciones al borrar el documento padre: si solo
 * se borrara `/retros/{id}`, las notas quedarían huérfanas ocupando espacio y
 * sin forma de llegar a ellas desde la app. Por eso se vacía `notes` primero.
 *
 * Las ACCIONES (`/retroActions`) no se tocan a propósito: persisten entre retros
 * hasta que se cierran, así que sobreviven a la retro que las originó.
 * @param {string} retroId
 */
export async function deleteRetro(retroId) {
  const notes = await getDocs(collection(db, 'retros', retroId, 'notes'));
  await Promise.all(notes.docs.map((n) => deleteDoc(n.ref)));
  await deleteDoc(doc(db, 'retros', retroId));
}

// ── Notas (anónimas hasta revelar + votos) ─────────────────────────────────────────────────

/**
 * Añade una nota. Nace con el VOTO DE SU AUTOR (RMR-TSK-0283): quien la escribe
 * ya está votándola al proponerla, y así el recuento no arranca en cero.
 *
 * El nombre del autor se guarda DENORMALIZADO (RMR-TSK-0285) porque un
 * participante no puede leer las fichas de sus compañeros (reglas de /people):
 * sin copiarlo aquí, solo el manager podría poner cara a las tarjetas. La UI lo
 * enseña únicamente cuando la zona se revela — anónimas al escribir, firmadas al
 * debatir.
 *
 * @param {string} retroId @param {string} columnId @param {string} text
 * @param {string} authorUid @param {string} [authorName]
 */
export async function addNote(retroId, columnId, text, authorUid, authorName = '') {
  const ref = await addDoc(collection(db, 'retros', retroId, 'notes'), {
    columnId, text: String(text ?? '').trim(), authorUid,
    authorName: String(authorName ?? '').trim(),
    voters: authorUid ? [authorUid] : [],
    createdAt: serverTimestamp(),
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

/**
 * Aplica un parche de agrupación a varias notas (RMR-TSK-0281). Recibe lo que
 * devuelven `groupPatch`/`ungroupPatch` del dominio: solo las notas que cambian.
 * @param {string} retroId
 * @param {ReadonlyArray<{ id: string, groupId: string|null }>} patches
 */
export async function setNoteGroups(retroId, patches) {
  await Promise.all((patches ?? []).map(({ id, groupId }) =>
    updateDoc(doc(db, 'retros', retroId, 'notes', id), { groupId })));
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
 *           scope: { type: 'team'|'squad', squadId?: string|null, label?: string|null } }} data
 * @returns {Promise<string>}
 */
export async function addAction(data) {
  const ref = await addDoc(collection(db, 'retroActions'), {
    text: String(data.text ?? '').trim(),
    owners: data.owners ?? [],
    ownerNames: data.ownerNames ?? [],
    ownerLeaderUid: data.ownerLeaderUid,
    // `squadId` referencia el catálogo /squads (RMR-TSK-0278); `label` se
    // conserva por las retros/acciones antiguas, con el squad como texto libre.
    scope: {
      type: data.scope?.type ?? 'team',
      squadId: data.scope?.squadId ?? null,
      label: data.scope?.label ?? null,
    },
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

/**
 * Retros de uno o varios squads (RMR-TSK-0278). Un squad puede tener gente de
 * varios managers, así que sus retros no se encuentran por `ownerLeaderUid`.
 * Firestore limita el `in` a 30 valores; con más squads se trocea.
 * @param {ReadonlyArray<string>} squadIds
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listRetrosBySquads(squadIds) {
  const ids = [...new Set((squadIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(chunks.map(async (chunk) => {
    const q = query(collection(db, 'retros'), where('scope.squadId', 'in', chunk));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));
  return results.flat();
}
