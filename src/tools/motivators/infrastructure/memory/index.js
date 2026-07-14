/**
 * Implementación in-memory de la persistencia de Motivadores (tests y prototipos).
 * Espeja la API de los puertos. Los agregados se calculan en vivo desde las
 * sesiones almacenadas (en Firestore los escribe la Cloud Function).
 *
 * @typedef {import('../../domain/types.js').Round} Round
 * @typedef {import('../../domain/types.js').Session} Session
 * @typedef {import('../../domain/types.js').GameId} GameId
 * @typedef {import('../../domain/ports.js').MotivatorsPersistence} MotivatorsPersistence
 */
import { deckCardIds } from '../../domain/decks.js';
import { computeAggregates } from '../../domain/aggregate.js';
import { sortRoundsChronologically } from '../../domain/rounds.js';

/**
 * @param {{ rounds?: Round[], sessions?: Session[] }} [seed]
 * @returns {MotivatorsPersistence}
 */
export function createMemoryMotivatorsPersistence(seed = {}) {
  /** @type {Map<string, Round>} */
  const rounds = new Map((seed.rounds ?? []).map((r) => [r.id, { ...r }]));
  /** @type {Map<string, Session>} */
  const sessions = new Map((seed.sessions ?? []).map((s) => [`${s.roundId}__${s.usuarioId}`, { ...s }]));

  return {
    rounds: {
      async listByGame(game) {
        return [...rounds.values()].filter((r) => r.game === game).map((r) => ({ ...r }));
      },
      async get(id) {
        const r = rounds.get(id);
        return r ? { ...r } : null;
      },
      async add(input) {
        const id = crypto.randomUUID();
        rounds.set(id, { ...input, id });
        return id;
      },
      async update(id, patch) {
        const r = rounds.get(id);
        if (!r) throw new Error(`Ronda ${id} no existe`);
        rounds.set(id, { ...r, ...patch, id });
      },
      async remove(id) {
        rounds.delete(id);
      },
    },
    sessions: {
      async save(sessionId, session) {
        sessions.set(sessionId, { ...session });
      },
      async listByUser(uid, game) {
        return [...sessions.values()].filter((s) => s.uid === uid && s.game === game).map((s) => ({ ...s }));
      },
      async listByRound(roundId) {
        return [...sessions.values()].filter((s) => s.roundId === roundId).map((s) => ({ ...s }));
      },
      async removeByRound(roundId) {
        for (const [key, s] of sessions) {
          if (s.roundId === roundId) sessions.delete(key);
        }
      },
    },
    aggregates: {
      async get(game) {
        const gameSessions = [...sessions.values()].filter((s) => s.game === game);
        const orderedRoundIds = sortRoundsChronologically(
          [...rounds.values()].filter((r) => r.game === game),
        ).map((r) => r.id);
        return computeAggregates(gameSessions, deckCardIds(game), { game, orderedRoundIds });
      },
    },
  };
}
