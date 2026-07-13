/**
 * Adaptador Firestore de Motivadores. Rondas globales (`/motivatorRounds`),
 * sesiones privadas con id determinista (`/motivatorSessions/{roundId}__{usuarioId}`)
 * y el documento público de agregados (`/motivatorAggregates/{game}`, lo escribe la
 * Cloud Function). Las fechas de ronda viajan como Timestamp en Firestore (para que
 * las reglas comparen `request.time`) y como ISO en el dominio.
 *
 * @typedef {import('../../domain/types.js').Round} Round
 * @typedef {import('../../domain/types.js').Session} Session
 * @typedef {import('../../domain/types.js').GameId} GameId
 * @typedef {import('../../domain/ports.js').MotivatorsPersistence} MotivatorsPersistence
 */
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, query, where, Timestamp,
} from 'firebase/firestore';

const ROUNDS = 'motivatorRounds';
const SESSIONS = 'motivatorSessions';
const AGGREGATES = 'motivatorAggregates';

/** Timestamp | ISO | Date → ISO string (o null). */
function toIso(value) {
  if (value == null) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** ISO → Firestore Timestamp. */
function toTimestamp(iso) {
  return Timestamp.fromDate(new Date(iso));
}

/** @param {string} id @param {Record<string, any>} data @returns {Round} */
function roundFromDoc(id, data) {
  return {
    id,
    game: data.game,
    name: data.name,
    startAt: toIso(data.startAt),
    endAt: toIso(data.endAt),
    active: data.active !== false,
    createdBy: data.createdBy ?? null,
    createdAt: toIso(data.createdAt),
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {MotivatorsPersistence}
 */
export function createFirestoreMotivatorsPersistence(db) {
  if (!db) throw new Error('createFirestoreMotivatorsPersistence requiere una instancia de Firestore (db)');
  return {
    rounds: {
      async listByGame(game) {
        const snap = await getDocs(query(collection(db, ROUNDS), where('game', '==', game)));
        return snap.docs.map((d) => roundFromDoc(d.id, d.data()));
      },
      async get(id) {
        const snap = await getDoc(doc(db, ROUNDS, id));
        return snap.exists() ? roundFromDoc(snap.id, snap.data()) : null;
      },
      async add(input) {
        const ref = await addDoc(collection(db, ROUNDS), {
          game: input.game,
          name: input.name,
          startAt: toTimestamp(input.startAt),
          endAt: toTimestamp(input.endAt),
          active: input.active !== false,
          createdBy: input.createdBy ?? null,
          createdAt: input.createdAt ? toTimestamp(input.createdAt) : Timestamp.now(),
        });
        return ref.id;
      },
      async update(id, patch) {
        const next = { ...patch };
        if (patch.startAt) next.startAt = toTimestamp(patch.startAt);
        if (patch.endAt) next.endAt = toTimestamp(patch.endAt);
        await updateDoc(doc(db, ROUNDS, id), next);
      },
    },
    sessions: {
      async save(sessionId, session) {
        await setDoc(doc(db, SESSIONS, sessionId), session);
      },
      async listByUser(uid, game) {
        // Filtro por uid (rules-safe: solo lee lo suyo) y game en memoria (evita índice compuesto).
        const snap = await getDocs(query(collection(db, SESSIONS), where('uid', '==', uid)));
        return snap.docs.map((d) => /** @type {Session} */ (d.data())).filter((s) => s.game === game);
      },
      async listByRound(roundId) {
        const snap = await getDocs(query(collection(db, SESSIONS), where('roundId', '==', roundId)));
        return snap.docs.map((d) => /** @type {Session} */ (d.data()));
      },
    },
    aggregates: {
      async get(game) {
        const snap = await getDoc(doc(db, AGGREGATES, game));
        return snap.exists() ? /** @type {any} */ (snap.data()) : null;
      },
    },
  };
}
