/**
 * Agregación pura de sesiones de motivadores. Nunca expone datos individuales:
 * produce medias, medianas, top-3 y distribución por motivador. Es la fuente de
 * verdad; la Cloud Function `onMotivatorSessionWritten` espeja esta lógica para
 * escribir el documento público `/motivatorAggregates/{game}`.
 *
 * @typedef {import('./types.js').Session} Session
 * @typedef {import('./types.js').MotivatorStat} MotivatorStat
 * @typedef {import('./types.js').AggregateBlock} AggregateBlock
 * @typedef {import('./types.js').Aggregates} Aggregates
 * @typedef {import('./types.js').GameId} GameId
 */
import { DECK_SIZE } from './types.js';

/** Redondeo a 1 decimal, tolerante a null. @param {number|null} n @returns {number|null} */
function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10;
}

/** Media de una lista no vacía. @param {number[]} xs @returns {number|null} */
function mean(xs) {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Mediana (interpolando el par central). @param {number[]} xs @returns {number|null} */
function median(xs) {
  if (xs.length === 0) return null;
  const s = xs.toSorted((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Estadística de un motivador a partir de las posiciones que recibió.
 * @param {string} motivadorId
 * @param {number[]} positions   Posiciones (1..size) en cada sesión que lo incluyó.
 * @param {number} size
 * @returns {MotivatorStat}
 */
function statFor(motivadorId, positions, size) {
  const distribution = Array.from({ length: size }, () => 0);
  for (const p of positions) {
    if (p >= 1 && p <= size) distribution[p - 1] += 1;
  }
  const respondents = positions.length;
  const top3Count = positions.filter((p) => p <= 3).length;
  return {
    motivadorId,
    averagePosition: round1(mean(positions)),
    medianPosition: round1(median(positions)),
    top3Count,
    top3Pct: respondents === 0 ? null : round1((top3Count / respondents) * 100),
    distribution,
    respondents,
  };
}

/**
 * Corte agregado de un conjunto de sesiones para un mazo dado.
 * @param {Session[]} sessions
 * @param {string[]} cardIds     Ids del mazo (define el universo de motivadores).
 * @param {number} [size]
 * @returns {AggregateBlock}
 */
export function aggregateBlock(sessions, cardIds, size = DECK_SIZE) {
  /** @type {Map<string, number[]>} */
  const positionsByCard = new Map(cardIds.map((id) => [id, []]));
  for (const s of sessions ?? []) {
    for (const { motivadorId, posicion } of s.orden ?? []) {
      const bucket = positionsByCard.get(motivadorId);
      if (bucket) bucket.push(posicion);
    }
  }
  /** @type {Record<string, MotivatorStat>} */
  const byMotivator = {};
  for (const id of cardIds) {
    byMotivator[id] = statFor(id, positionsByCard.get(id) ?? [], size);
  }
  const ranking = cardIds
    .map((id) => byMotivator[id])
    .toSorted((a, b) => rankKey(a) - rankKey(b));
  return { respondents: (sessions ?? []).length, byMotivator, ranking };
}

/** Clave de orden del ranking: sin datos va al final. @param {MotivatorStat} stat @returns {number} */
function rankKey(stat) {
  return stat.averagePosition == null ? Number.POSITIVE_INFINITY : stat.averagePosition;
}

/** Agrupa sesiones por una clave (roundId, equipoId…). @param {Session[]} sessions @param {(s: Session) => string|null} keyOf @returns {Map<string, Session[]>} */
function groupBy(sessions, keyOf) {
  /** @type {Map<string, Session[]>} */
  const groups = new Map();
  for (const s of sessions ?? []) {
    const key = keyOf(s);
    if (key == null) continue;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Mínimo de respuestas para publicar un corte agregado (RMR-BUG-0051). Con menos,
 * `distribution` y `averagePosition` reconstruyen el orden que eligió cada
 * persona, así que el corte deja de ser anónimo. Mismo criterio que la marea.
 */
export const MIN_RESPONDENTS = 3;

/**
 * Corte RETENIDO por anonimato: mantiene la forma (y cuánta gente respondió,
 * que no identifica a nadie) pero sin ningún dato de lo que eligieron.
 * @param {number} respondents @param {string[]} cardIds @param {number} size
 * @returns {AggregateBlock}
 */
function withheldBlock(respondents, cardIds, size) {
  return { ...aggregateBlock([], cardIds, size), respondents };
}

/**
 * Agregados completos de un juego: global, por ronda, por equipo/líder y la
 * evolución de la posición media de cada motivador a lo largo de las rondas.
 *
 * Los cortes por debajo de `minCount` NO se publican (RMR-BUG-0051): los de
 * equipo y ronda se omiten del todo —así ni aparecen en el selector— y el global
 * se devuelve retenido, conservando solo el recuento.
 * @param {Session[]} sessions
 * @param {string[]} cardIds
 * @param {{ game?: GameId, orderedRoundIds?: string[], size?: number, minCount?: number }} [options]
 * @returns {Aggregates}
 */
export function computeAggregates(sessions, cardIds, options = {}) {
  const { game, orderedRoundIds = [], size = DECK_SIZE, minCount = MIN_RESPONDENTS } = options;
  const all = sessions ?? [];

  const byRoundSessions = groupBy(all, (s) => s.roundId);
  const byLeaderSessions = groupBy(all, (s) => s.equipoId);

  /** @type {Record<string, AggregateBlock>} */
  const byRound = {};
  for (const [roundId, list] of byRoundSessions) {
    if (list.length < minCount) continue;
    byRound[roundId] = aggregateBlock(list, cardIds, size);
  }

  /** @type {Record<string, AggregateBlock>} */
  const byLeader = {};
  for (const [leaderId, list] of byLeaderSessions) {
    if (list.length < minCount) continue;
    byLeader[leaderId] = aggregateBlock(list, cardIds, size);
  }

  // Evolución: para cada motivador, su posición media por ronda en orden temporal.
  const roundOrder = orderedRoundIds.length > 0 ? orderedRoundIds : [...byRoundSessions.keys()];
  /** @type {Record<string, Array<{ roundId: string, averagePosition: number|null }>>} */
  const evolution = {};
  for (const id of cardIds) {
    evolution[id] = roundOrder
      .filter((roundId) => byRound[roundId])
      .map((roundId) => ({ roundId, averagePosition: byRound[roundId].byMotivator[id]?.averagePosition ?? null }));
  }

  return {
    game: /** @type {GameId} */ (game),
    respondents: all.length,
    // Se publica para que la interfaz pueda explicar POR QUÉ falta un corte.
    minCount,
    global: all.length >= minCount
      ? aggregateBlock(all, cardIds, size)
      : withheldBlock(all.length, cardIds, size),
    byRound,
    byLeader,
    evolution,
  };
}
