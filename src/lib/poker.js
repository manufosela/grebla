/**
 * Acceso a Scrum Poker (RMR-TSK-0317). Un manager/head crea una sesión
 * (/pokerSessions/{id}); el equipo se une (/pokerSessions/{id}/players/{uid}) y
 * vota en oculto (/pokerSessions/{id}/votes/{uid}). La OCULTACIÓN es real, por
 * reglas: el documento de presencia (`players`) es público —muestra quién se ha
 * unido y quién ha votado (`votedRound`), pero NO el valor— mientras que el voto
 * (`votes`) solo se puede leer una vez la sesión está `revealed`. Así nadie ve la
 * carta ajena antes de tiempo ni con la consola.
 *
 * RONDAS: la sesión lleva `round`. «Pasar de tema» solo incrementa `round` (con
 * `revealed:false`); los votos anteriores quedan obsoletos por sí solos, sin que
 * el dueño tenga que borrar los documentos de los demás (las reglas no lo
 * permiten). La lógica pura (mazo y recuento) vive en tools/poker/domain.
 */
import {
  doc, collection, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  writeBatch, onSnapshot, query, where, orderBy, serverTimestamp, increment,
} from 'firebase/firestore';
import { db, app } from './firebase.js';
import { isValidCard } from '../tools/poker/domain/deck.js';

const SESSIONS = 'pokerSessions';

/** Milisegundos de un createdAt (Timestamp, número o ausente), para ordenar. */
function createdAtMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  return typeof value.toMillis === 'function' ? value.toMillis() : 0;
}

// ── Sesiones ─────────────────────────────────────────────────────────────────

/**
 * Crea una sesión de poker. Modo `simple` = juego de voto directo (se vota desde
 * el principio). Modo `linear` = refinamiento del backlog de un squad (se elige la
 * tarea y se «activa la votación» por tarea).
 * @param {{ name: string, ownerLeaderUid: string, mode?: 'simple'|'linear', squad?: {linearLabel: string, name: string}|null }} data
 * @returns {Promise<string>} id de la sesión
 */
export async function createSession(data) {
  if (!data?.ownerLeaderUid) throw new Error('createSession requiere ownerLeaderUid');
  const mode = data.mode === 'linear' ? 'linear' : 'simple';
  const ref = await addDoc(collection(db, SESSIONS), {
    name: String(data.name ?? '').trim(),
    ownerLeaderUid: data.ownerLeaderUid,
    mode,
    squad: mode === 'linear' && data.squad
      ? { linearLabel: data.squad.linearLabel, name: data.squad.name ?? data.squad.linearLabel }
      : null,
    tasks: [],
    currentTaskId: null,
    // En simple se vota desde el principio; en linear, tras «activar votación».
    votingActive: mode === 'simple',
    results: {},
    revealed: false,
    round: 1,
    status: 'open',
    createdAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

// ── Modo Linear: squads y backlog ────────────────────────────────────────────

/** Squads disponibles para refinar (unidades LEAN kind=squad, con label de Linear). */
export async function listSquads() {
  const snap = await getDocs(query(collection(db, 'leanTeams'), where('kind', '==', 'squad')));
  return snap.docs
    .map((d) => ({ id: d.id, name: d.data().name, linearLabel: d.data().linearLabel }))
    .filter((s) => s.linearLabel && s.linearLabel !== 'undefined')
    .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
}

/** Backlog de un squad (issues de Linear con ese label), vía Cloud Function. */
export async function listSquadBacklog(linearLabel) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'listSquadBacklog');
  const res = await fn({ linearLabel });
  return res.data?.tasks ?? [];
}

/** Fija las tareas del backlog a refinar (las que marcó el manager). Denormalizadas. */
export function setSessionTasks(sessionId, tasks) {
  const clean = (tasks ?? []).map((t) => ({
    id: t.id, identifier: t.identifier ?? t.id, title: t.title ?? '', url: t.url ?? null,
  }));
  return updateDoc(doc(db, SESSIONS, sessionId), {
    tasks: clean, currentTaskId: null, votingActive: false, revealed: false,
  });
}

/** Marca la tarea actual a refinar: arranca en «discusión» (sin votar aún) y ronda limpia. */
export function setCurrentTask(sessionId, taskId) {
  return updateDoc(doc(db, SESSIONS, sessionId), {
    currentTaskId: taskId, votingActive: false, revealed: false, round: increment(1),
  });
}

/** El manager «activa la votación» de la tarea actual. */
export function activateVoting(sessionId) {
  return updateDoc(doc(db, SESSIONS, sessionId), { votingActive: true, revealed: false });
}

/** Guarda la estimación acordada de una tarea, asociada a su id de Linear. */
export function saveEstimate(sessionId, taskId, value) {
  return updateDoc(doc(db, SESSIONS, sessionId), { [`results.${taskId}`]: { value, at: serverTimestamp() } });
}

/**
 * Sesiones de un manager —o de toda la rama de un supermanager (uid o array de
 * uids)—, más recientes primero. Con un solo dueño mantiene el `==` de siempre.
 * @param {string|ReadonlyArray<string>} ownerScope
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listSessions(ownerScope) {
  const owners = [...new Set((Array.isArray(ownerScope) ? ownerScope : [ownerScope]).filter(Boolean))];
  if (owners.length === 0) return [];
  const batches = await Promise.all(owners.map(async (owner) => {
    const snap = await getDocs(query(collection(db, SESSIONS), where('ownerLeaderUid', '==', owner), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));
  return batches.flat().sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt));
}

/** Observa una sesión EN VIVO (tema/ronda/revelado cambian para todos a la vez). */
export function watchSession(sessionId, onData, onError) {
  return onSnapshot(
    doc(db, SESSIONS, sessionId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

/** Observa la PRESENCIA en vivo (quién se ha unido y quién ha votado, sin valor). */
export function watchPlayers(sessionId, onData, onError) {
  return onSnapshot(
    collection(db, SESSIONS, sessionId, 'players'),
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError,
  );
}

/**
 * Observa los VOTOS en vivo. Las reglas solo dejan leer la colección entera
 * cuando la sesión está `revealed` (antes, cada uno solo lee el suyo), así que
 * SOLO debe llamarse una vez revelada: por eso el error se propaga al caller.
 */
export function watchVotes(sessionId, onData, onError) {
  return onSnapshot(
    collection(db, SESSIONS, sessionId, 'votes'),
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError,
  );
}

/**
 * «Volver a votar»: arranca una votación limpia incrementando la ronda y
 * ocultando los votos. Solo el dueño (o superadmin) puede: lo imponen las reglas.
 * @param {string} sessionId
 */
export function revote(sessionId) {
  return updateDoc(doc(db, SESSIONS, sessionId), {
    round: increment(1),
    revealed: false,
    votingActive: true,
  });
}

/** Revela los votos (cualquiera con acceso; la UI lo ofrece al votar todos). */
export function reveal(sessionId) {
  return updateDoc(doc(db, SESSIONS, sessionId), { revealed: true });
}

/** Cierra la sesión: deja de admitir participación. */
export function closeSession(sessionId) {
  return updateDoc(doc(db, SESSIONS, sessionId), { status: 'closed', closedAt: serverTimestamp() });
}

/**
 * Borra una sesión y SUS subcolecciones (Firestore no las borra en cascada). Lo
 * hace el dueño o un superadmin.
 */
export async function deleteSession(sessionId) {
  for (const sub of ['players', 'votes']) {
    const snap = await getDocs(collection(db, SESSIONS, sessionId, sub));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, SESSIONS, sessionId));
}

// ── Participación ────────────────────────────────────────────────────────────

/**
 * Se une a la sesión (idempotente): registra la presencia con el nombre
 * denormalizado. No reinicia `votedRound` si ya estaba dentro (reentrar no borra
 * su voto de la ronda en curso).
 * @param {string} sessionId @param {string} uid @param {string} name
 */
export async function joinSession(sessionId, uid, name) {
  const ref = doc(db, SESSIONS, sessionId, 'players', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { name: String(name ?? snap.data().name ?? '').trim() });
    return;
  }
  await setDoc(ref, { name: String(name ?? '').trim(), votedRound: null, joinedAt: serverTimestamp() });
}

/**
 * Emite (o cambia) el voto de la ronda actual, de forma atómica: escribe el
 * valor en /votes y marca `votedRound` en la presencia. Valida la carta en el
 * boundary (sin fallbacks silenciosos).
 * @param {string} sessionId @param {string} uid @param {number} round @param {string} value
 */
export function castVote(sessionId, uid, round, value) {
  if (!isValidCard(value)) throw new Error(`Carta no válida: ${value}`);
  if (!Number.isInteger(round)) throw new Error('castVote requiere la ronda actual');
  const batch = writeBatch(db);
  batch.set(doc(db, SESSIONS, sessionId, 'votes', uid), { value, round });
  batch.set(doc(db, SESSIONS, sessionId, 'players', uid), { votedRound: round }, { merge: true });
  return batch.commit();
}

/** Mi propio voto de esta sesión (siempre legible), para rehidratar la carta elegida al recargar. */
export async function getMyVote(sessionId, uid) {
  const snap = await getDoc(doc(db, SESSIONS, sessionId, 'votes', uid));
  return snap.exists() ? snap.data() : null;
}
