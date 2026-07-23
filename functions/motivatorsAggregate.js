/**
 * Agregación de MOTIVADORES para la Cloud Function — espejo puro de
 * src/tools/motivators/domain/aggregate.js.
 *
 * Vive aquí, dentro de functions/, porque el paquete de Cloud Functions se
 * despliega solo (no puede importar de ../src). Es el mismo motivo por el que
 * marea tiene functions/pulseAggregate.js. La copia física es inevitable, pero
 * NO puede divergir en silencio: functions/motivatorsAggregate.test.js ejecuta
 * ESTE módulo y el dominio sobre las mismas sesiones y exige el mismo resultado,
 * así que cualquier cambio en uno que no se replique en el otro rompe el test
 * (fue lo que hizo falta arreglar dos veces en RMR-BUG-0051).
 */

/** Tamaño de mazo (espejo de DECK_SIZE del dominio). */
export const MOTIVATOR_DECK_SIZE = 10;

// Ids de carta por juego (espejo de src/tools/motivators/domain/decks.js). Solo
// los ids: los textos viven en el cliente; aquí solo se necesita el universo.
export const MOTIVATOR_DECK_IDS = {
  moving_motivators: ['curiosity', 'honor', 'acceptance', 'mastery', 'power', 'freedom', 'relatedness', 'order', 'goal', 'status'],
  affective_motivators: ['listening', 'trust', 'authenticity', 'psychological_safety', 'accompanied_vulnerability', 'holistic_care', 'belonging', 'growth_support', 'mutual_commitment', 'closeness'],
};

/**
 * Mínimo de respuestas para publicar un corte (RMR-BUG-0051). Espejo de
 * MIN_RESPONDENTS en src/tools/motivators/domain/aggregate.js. Con menos, la
 * distribución y la posición media reconstruyen lo que eligió cada persona.
 */
export const MOT_MIN_RESPONDENTS = 3;

const motRound1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const motMean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
function motMedian(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Estadística de un motivador (espejo de statFor del dominio). */
function motStatFor(motivadorId, positions, size) {
  const distribution = Array.from({ length: size }, () => 0);
  for (const p of positions) {
    if (p >= 1 && p <= size) distribution[p - 1] += 1;
  }
  const respondents = positions.length;
  const top3Count = positions.filter((p) => p <= 3).length;
  return {
    motivadorId,
    averagePosition: motRound1(motMean(positions)),
    medianPosition: motRound1(motMedian(positions)),
    top3Count,
    top3Pct: respondents === 0 ? null : motRound1((top3Count / respondents) * 100),
    distribution,
    respondents,
  };
}

/** Corte agregado (espejo de aggregateBlock del dominio). */
function motAggregateBlock(sessions, cardIds, size) {
  const positionsByCard = new Map(cardIds.map((id) => [id, []]));
  for (const s of sessions ?? []) {
    for (const { motivadorId, posicion } of s.orden ?? []) {
      const bucket = positionsByCard.get(motivadorId);
      if (bucket) bucket.push(posicion);
    }
  }
  const byMotivator = {};
  for (const id of cardIds) byMotivator[id] = motStatFor(id, positionsByCard.get(id) ?? [], size);
  const rankKey = (stat) => (stat.averagePosition == null ? Number.POSITIVE_INFINITY : stat.averagePosition);
  const ranking = cardIds.map((id) => byMotivator[id]).sort((a, b) => rankKey(a) - rankKey(b));
  return { respondents: (sessions ?? []).length, byMotivator, ranking };
}

function motGroupBy(sessions, keyOf) {
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

/** Corte retenido por anonimato: conserva el recuento, no lo que eligieron. */
function motWithheldBlock(respondents, cardIds, size) {
  return { ...motAggregateBlock([], cardIds, size), respondents };
}

/**
 * Agregados completos de un juego (espejo de computeAggregates del dominio).
 * @param {Array<Record<string, any>>} sessions
 * @param {string[]} cardIds
 * @param {string} game
 * @param {string[]} orderedRoundIds
 * @param {number} size
 * @param {number} [minCount]
 * @param {Record<string, string>} [departmentByLeader]  leaderUid → uid del Head
 */
export function motComputeAggregates(sessions, cardIds, game, orderedRoundIds, size, minCount = MOT_MIN_RESPONDENTS, departmentByLeader = {}) {
  const all = sessions ?? [];
  const byRoundSessions = motGroupBy(all, (s) => s.roundId);
  const byLeaderSessions = motGroupBy(all, (s) => s.equipoId);
  // Corte por departamento (RMR-TSK-0296): junta los equipos del mismo Head.
  const byDeptSessions = motGroupBy(all, (s) => departmentByLeader[s.equipoId] ?? null);

  // Los cortes por debajo del umbral NO se escriben: el documento es público
  // para cualquier autenticado, así que lo que no se publica es lo único que
  // de verdad queda protegido.
  const byRound = {};
  for (const [roundId, list] of byRoundSessions) {
    if (list.length < minCount) continue;
    byRound[roundId] = motAggregateBlock(list, cardIds, size);
  }
  const byLeader = {};
  for (const [leaderId, list] of byLeaderSessions) {
    if (list.length < minCount) continue;
    byLeader[leaderId] = motAggregateBlock(list, cardIds, size);
  }
  const byDepartment = {};
  for (const [dept, list] of byDeptSessions) {
    if (list.length < minCount) continue;
    byDepartment[dept] = motAggregateBlock(list, cardIds, size);
  }

  const roundOrder = orderedRoundIds.length > 0 ? orderedRoundIds : [...byRoundSessions.keys()];
  const evolution = {};
  for (const id of cardIds) {
    evolution[id] = roundOrder
      .filter((roundId) => byRound[roundId])
      .map((roundId) => ({ roundId, averagePosition: byRound[roundId].byMotivator[id]?.averagePosition ?? null }));
  }

  return {
    game,
    respondents: all.length,
    minCount,
    global: all.length >= minCount
      ? motAggregateBlock(all, cardIds, size)
      : motWithheldBlock(all.length, cardIds, size),
    byRound,
    byLeader,
    byDepartment,
    evolution,
  };
}
