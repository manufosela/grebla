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
  doc, collection, addDoc, getDoc, getDocs, setDoc, updateDoc,
  writeBatch, onSnapshot, query, where, orderBy, serverTimestamp, increment, arrayUnion,
} from 'firebase/firestore';
import { db, getRegionalFunctions } from './firebase.js';
import { isValidCardFor, buildDeck, scaleById } from '../tools/poker/domain/deck.js';
import { isAxisLevel } from '../tools/poker/domain/magnitude.js';

const SESSIONS = 'pokerSessions';

/** Milisegundos de un createdAt (Timestamp, número o ausente), para ordenar. */
function createdAtMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  return typeof value.toMillis === 'function' ? value.toMillis() : 0;
}

// ── Sesiones ─────────────────────────────────────────────────────────────────

/**
 * Crea una sesión de poker: voto directo desde el principio. (El modo «refinar
 * backlog de Linear» se retiró en RMR-TSK-0517: la referencia a Linear va por
 * votación, no por sesión.)
 * El MAZO se fija al convocar y viaja con la sesión (RMR-TSK-0481): así una
 * estimación en curso no cambia de cartas porque alguien toque un catálogo.
 * El organizador decide al convocar si vota (RMR-TSK-0522) y deja la lista de
 * tareas a estimar; la primera pasa a ser la actual.
 * @param {{ name: string, ownerLeaderUid: string, scale?: string, ownerVotes?: boolean, tasks?: Array<{id:string,title:string,value:null}> }} data
 * @returns {Promise<string>} id de la sesión
 */
export async function createSession(data) {
  if (!data?.ownerLeaderUid) throw new Error('createSession requiere ownerLeaderUid');
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const ref = await addDoc(collection(db, SESSIONS), {
    name: String(data.name ?? '').trim(),
    ownerLeaderUid: data.ownerLeaderUid,
    ownerVotes: data.ownerVotes !== false,
    mode: 'simple',
    scale: scaleById(data.scale).id,
    deck: buildDeck(data.scale),
    tasks,
    currentTaskId: tasks[0]?.id ?? null,
    revealed: false,
    round: 1,
    status: 'open',
    createdAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

/**
 * Tareas de la sesión (RMR-TSK-0522): la lista entera y cuál es la actual. Solo
 * el dueño escribe la sesión, así que la lista viaja completa: no hay carreras.
 * @param {string} sessionId @param {Array<{id:string,title:string,value:string|null}>} tasks @param {string|null} currentTaskId
 */
export function setSessionTasks(sessionId, tasks, currentTaskId) {
  return updateDoc(doc(db, SESSIONS, sessionId), { tasks, currentTaskId });
}

/**
 * Cierra la tarea actual con el valor acordado y pasa a la siguiente con una
 * ronda limpia (votos ocultos). Si no queda siguiente, currentTaskId queda null:
 * el organizador añade otra o termina.
 */
export function closeCurrentTask(sessionId, tasks, nextId) {
  return updateDoc(doc(db, SESSIONS, sessionId), {
    tasks, currentTaskId: nextId, round: increment(1), revealed: false, voteTitle: '', voteRef: null, voteIssue: null, issueOpen: false,
  });
}

/** Termina la sesión: queda la lista de tareas con sus valores, y ya no se vota. */
export function finishSession(sessionId) {
  return updateDoc(doc(db, SESSIONS, sessionId), { status: 'finished', finishedAt: serverTimestamp(), revealed: false });
}

/** Título de la votación en curso: qué se está estimando (RMR-TSK-0482). */
export function setVoteTitle(sessionId, title) {
  return updateDoc(doc(db, SESSIONS, sessionId), { voteTitle: String(title ?? '').trim().slice(0, 120) });
}

/**
 * Ficha de una historia de Linear por su identificador, vía Cloud Function
 * (RMR-TSK-0518). Solo la llama el organizador: la ficha se guarda en la
 * sesión y los demás la leen de ahí. Devuelve null si Linear no la conoce.
 * @param {string} identifier BB-1234
 */
export async function fetchLinearIssue(identifier) {
  const { httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable(await getRegionalFunctions(), 'getLinearIssue');
  const res = await fn({ identifier });
  return res.data?.issue ?? null;
}

/**
 * Referencia de Linear de la votación en curso y su ficha, para que todos la
 * vean al lado de la mesa. Con referencia vacía se quitan las dos.
 * @param {string} sessionId @param {string} ref @param {object|null} issue
 */
export function setVoteRef(sessionId, ref, issue) {
  const voteRef = String(ref ?? '').trim() || null;
  return updateDoc(doc(db, SESSIONS, sessionId), { voteRef, voteIssue: voteRef ? (issue ?? null) : null, issueOpen: false });
}

/**
 * Enseña la historia a todos (RMR-TSK-0524): la ficha se guarda en la sesión
 * y `issueOpen` abre el modal en todas las pantallas. Lo decide el organizador.
 */
export function showIssue(sessionId, ref, issue) {
  return updateDoc(doc(db, SESSIONS, sessionId), { voteRef: ref, voteIssue: issue, issueOpen: true });
}

/** Abre o cierra el modal de la historia para todos. Solo el organizador (reglas). */
export function setIssueOpen(sessionId, open) {
  return updateDoc(doc(db, SESSIONS, sessionId), { issueOpen: !!open });
}

/**
 * Cierra una votación con el valor ACORDADO y la deja en el historial de la
 * sesión (RMR-TSK-0482): qué se estimó, en cuánto y en qué ronda se llegó.
 *
 * El recorrido importa —de un 3 y un 8 a un 5 unánime dice más que el 5 suelto—,
 * así que se añade al historial en vez de sobrescribir nada, y la ronda queda
 * guardada con él.
 *
 * @param {string} sessionId
 * @param {{ title?: string, value: string, round: number }} acuerdo
 */
export function recordAgreement(sessionId, acuerdo) {
  if (!acuerdo?.value) throw new Error('recordAgreement requiere el valor acordado');
  return updateDoc(doc(db, SESSIONS, sessionId), {
    agreements: arrayUnion({
      title: String(acuerdo.title ?? '').trim() || null,
      ref: String(acuerdo.ref ?? '').trim() || null,
      value: acuerdo.value,
      round: acuerdo.round ?? null,
      at: new Date().toISOString(),
    }),
    // La siguiente votación empieza limpia: sin título ni ficha de la anterior.
    voteTitle: '',
    voteRef: null,
    voteIssue: null,
  });
}

/**
 * Sesiones visibles para TODOS (RMR-BUG-0121): las abiertas de la organización
 * y las terminadas, más recientes primero. Desde que cualquier perfil participa
 * (RMR-TSK-0513) la lista ya no es «las mías o las de mi manager»: quien no
 * era del equipo del organizador no encontraba la sesión. Borrar sigue siendo
 * solo del dueño (la UI lo esconde y las reglas lo imponen). Índice compuesto
 * status + createdAt en firestore.indexes.json.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listVisibleSessions() {
  const snap = await getDocs(query(
    collection(db, SESSIONS),
    where('status', 'in', ['open', 'finished']),
    orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Una sesión por id (para abrirla desde un enlace compartido, fuera de la lista). */
export async function getSession(sessionId) {
  const snap = await getDoc(doc(db, SESSIONS, sessionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Observa una sesión EN VIVO. Se piden los cambios de metadatos para poder
 * distinguir el revelado OPTIMISTA local (escritura pendiente) del CONFIRMADO por
 * el servidor: suscribirse a /votes con el revelado aún pendiente provoca un
 * permission-denied transitorio (la regla lee `revealed` del servidor). Por eso
 * `onData` recibe también `hasPendingWrites`.
 */
export function watchSession(sessionId, onData, onError) {
  return onSnapshot(
    doc(db, SESSIONS, sessionId),
    { includeMetadataChanges: true },
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null, snap.metadata.hasPendingWrites),
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
export function deleteSession(sessionId) {
  // Se CIERRA, no se borra el documento (RMR-BUG-0119). Borrar en cascada
  // obligaba a listar /votes, y esa lectura está prohibida mientras la sesión
  // no se revela —también al dueño—, porque la ocultación del voto es real.
  // Una sesión cerrada desaparece de la lista y no se puede volver a abrir.
  return updateDoc(doc(db, SESSIONS, sessionId), { status: 'closed', closedAt: serverTimestamp() });
}

// ── Participación ────────────────────────────────────────────────────────────

/**
 * Se une a la sesión (idempotente): registra la presencia con el nombre
 * denormalizado. No reinicia `votedRound` si ya estaba dentro (reentrar no borra
 * su voto de la ronda en curso).
 * @param {string} sessionId @param {string} uid @param {string} name
 */
export async function joinSession(sessionId, uid, name, { spectator = false } = {}) {
  const ref = doc(db, SESSIONS, sessionId, 'players', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { name: String(name ?? snap.data().name ?? '').trim() });
    return;
  }
  // El organizador que dijo que no vota entra como observador desde el principio (RMR-TSK-0522).
  await setDoc(ref, { name: String(name ?? '').trim(), votedRound: null, joinedAt: serverTimestamp(), spectator });
}

/**
 * Emite (o cambia) el voto de la ronda actual, de forma atómica: escribe el
 * valor en /votes y marca `votedRound` en la presencia. Valida la carta en el
 * boundary (sin fallbacks silenciosos) contra el mazo DE ESA SESIÓN: una sesión
 * de tallas no acepta un 13 solo porque exista en el otro mazo (RMR-TSK-0481).
 *
 * Si se votó por complejidad × esfuerzo (RMR-TSK-0516) se guardan los ejes con
 * la carta: al revelar se enseñan para descomponer el número en el debate.
 * @param {string} sessionId @param {string} uid @param {number} round @param {string} value
 * @param {{ deck?: ReadonlyArray<string>|null }} [session]  la sesión en curso
 * @param {{ complexity: number, effort: number }|null} [axes]  los dos ejes, si se votó así
 */
export function castVote(sessionId, uid, round, value, session, axes = null) {
  if (!isValidCardFor(session, value)) throw new Error(`Carta no válida: ${value}`);
  if (!Number.isInteger(round)) throw new Error('castVote requiere la ronda actual');
  if (axes !== null && !(isAxisLevel(axes?.complexity) && isAxisLevel(axes?.effort))) {
    throw new Error('Los ejes van del 1 al 5');
  }
  const batch = writeBatch(db);
  const vote = axes ? { value, round, axes: { complexity: axes.complexity, effort: axes.effort } } : { value, round };
  batch.set(doc(db, SESSIONS, sessionId, 'votes', uid), vote);
  batch.set(doc(db, SESSIONS, sessionId, 'players', uid), { votedRound: round }, { merge: true });
  return batch.commit();
}

/** Mi propio voto de esta sesión (siempre legible), para rehidratar la carta elegida al recargar. */
export async function getMyVote(sessionId, uid) {
  const snap = await getDoc(doc(db, SESSIONS, sessionId, 'votes', uid));
  return snap.exists() ? snap.data() : null;
}

/** Marca (o desmarca) al jugador como observador («solo ver»): persiste en la sesión. */
export function setSpectator(sessionId, uid, spectator) {
  return setDoc(doc(db, SESSIONS, sessionId, 'players', uid), { spectator: !!spectator }, { merge: true });
}

/** El jugador se salta la ronda actual («fuera de mi ámbito»). */
export function skipRound(sessionId, uid, round) {
  return setDoc(doc(db, SESSIONS, sessionId, 'players', uid), { skippedRound: round }, { merge: true });
}

/** Vuelve a la ronda (deshace «fuera de mi ámbito»). */
export function unskipRound(sessionId, uid) {
  return setDoc(doc(db, SESSIONS, sessionId, 'players', uid), { skippedRound: null }, { merge: true });
}
