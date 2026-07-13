/**
 * Puertos (interfaces) de la persistencia de Motivadores. Las rondas son globales
 * (las gestiona el superadmin). Las sesiones son privadas del jugador. Los
 * agregados son un documento público que escribe la Cloud Function.
 *
 * @typedef {import('./types.js').Round} Round
 * @typedef {import('./types.js').Session} Session
 * @typedef {import('./types.js').Aggregates} Aggregates
 * @typedef {import('./types.js').GameId} GameId
 *
 * @typedef {Object} RoundRepository
 * @property {(game: GameId) => Promise<Round[]>} listByGame
 * @property {(id: string) => Promise<Round|null>} get
 * @property {(input: Omit<Round, 'id'>) => Promise<string>} add
 * @property {(id: string, patch: Partial<Round>) => Promise<void>} update
 *
 * @typedef {Object} SessionRepository
 * @property {(sessionId: string, session: Session) => Promise<void>} save   Upsert (id determinista).
 * @property {(usuarioId: string, game: GameId) => Promise<Session[]>} listByUser
 * @property {(roundId: string) => Promise<Session[]>} listByRound   Solo superadmin / Cloud Function.
 *
 * @typedef {Object} AggregateRepository
 * @property {(game: GameId) => Promise<Aggregates|null>} get
 *
 * @typedef {Object} MotivatorsPersistence
 * @property {RoundRepository} rounds
 * @property {SessionRepository} sessions
 * @property {AggregateRepository} aggregates
 */
