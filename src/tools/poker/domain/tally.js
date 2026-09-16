/**
 * Recuento y resumen de una votación de Scrum Poker (RMR-TSK-0317). Dominio puro
 * (sin Firebase).
 *
 * Modelo de RONDAS: la sesión lleva un contador `round`. Un jugador ha votado
 * «en esta ronda» cuando su `votedRound` coincide con la ronda actual, y su voto
 * (en /votes) guarda la `round` en que se emitió. Así, «pasar de tema» es solo
 * incrementar `round` en la sesión: los votos anteriores quedan obsoletos por sí
 * solos, sin que nadie tenga que borrar los documentos de los demás (lo que las
 * reglas no permitirían). Los valores solo se leen tras `revealed`.
 */
import { cardNumber, SPLIT_CARD, UNDECIDED_CARDS } from './deck.js';

/** Voto de una carta que se lee de un objeto o de un Map indexado por uid. */
function voteFor(votesByUid, uid) {
  return votesByUid instanceof Map ? votesByUid.get(uid) : votesByUid?.[uid];
}

/** ¿Ha votado este jugador en la ronda actual? */
export function hasVotedThisRound(player, round) {
  return !!player && player.votedRound === round;
}

/** Cuántos de los jugadores unidos han votado ya en la ronda actual. */
export function countVoted(players, round) {
  return (players ?? []).filter((p) => hasVotedThisRound(p, round)).length;
}

/** ¿Es este jugador un observador («solo ver»)? No se le ofrece el mazo. */
export function isSpectator(player) {
  return !!player && player.spectator === true;
}

/** ¿Se ha saltado este jugador la ronda actual («fuera de mi ámbito»)? */
export function hasSkippedRound(player, round) {
  return !!player && player.skippedRound === round;
}

/** Jugadores que SÍ votan en la ronda: ni observadores ni fuera de ámbito. */
export function activeVoters(players, round) {
  return (players ?? []).filter((p) => !isSpectator(p) && !hasSkippedRound(p, round));
}

/** Cuántos votantes ACTIVOS han votado (nunca supera al total de activos). */
export function countActiveVoted(players, round) {
  return activeVoters(players, round).filter((p) => hasVotedThisRound(p, round)).length;
}

/**
 * ¿Han votado TODOS los que se han unido? (y hay al menos uno). Es lo que
 * habilita el botón «Revelar» para todos: revelar antes no rompe nada, pero se
 * ofrece solo cuando la mesa está completa.
 */
export function allVoted(players, round) {
  const list = players ?? [];
  return list.length > 0 && list.every((p) => hasVotedThisRound(p, round));
}

/**
 * Une jugadores y votos de la ronda: para cada jugador que votó en la ronda
 * actual, su carta. Descarta votos obsoletos (de una ronda anterior). El `value`
 * es null si el voto aún no ha llegado (carrera de suscripciones).
 * @param {Array<{uid:string,name?:string,votedRound?:number}>} players
 * @param {Map<string,{value:string,round:number}>|Record<string,{value:string,round:number}>} votesByUid
 * @param {number} round
 * Si el voto se emitió por ejes (RMR-TSK-0516) llegan también: el debate
 * empieza por descomponer la carta, y no es lo mismo un 8 por complejidad que
 * un 8 por esfuerzo.
 * @returns {Array<{uid:string,name:string,value:string|null,axes:{complexity:number,effort:number}|null}>}
 */
export function revealedVotes(players, votesByUid, round) {
  return (players ?? [])
    .filter((p) => hasVotedThisRound(p, round) && !isSpectator(p) && !hasSkippedRound(p, round))
    .map((p) => {
      const vote = voteFor(votesByUid, p.uid);
      const actual = vote?.round === round;
      return {
        uid: p.uid,
        name: p.name ?? '',
        value: actual ? vote.value : null,
        axes: actual && vote.axes ? { complexity: vote.axes.complexity, effort: vote.axes.effort } : null,
      };
    });
}

/**
 * Juicio de las cartas reveladas (RMR-TSK-0521): ACUERDO si todas coinciden y
 * dicen algo, y si no, cuáles son la carta más BAJA y la más ALTA para que el
 * debate empiece por ellas. Nada de medias: promediar es el atajo que mata la
 * ceremonia, sale un número rápido y nadie aprende nada.
 *
 * El orden lo da el mazo de la sesión (una talla no es un número, y «partir»
 * está por encima de todo). «?» y «☕», de sesiones antiguas, no entran en el
 * orden ni permiten acuerdo: dicen «no lo sé» y «paremos».
 *
 * @param {Array<string|null>} values
 * @param {ReadonlyArray<string>} [deck] orden de las cartas; sin él, numérico con «partir» al final
 */
export function judgeVotes(values, deck) {
  const cards = (values ?? []).filter((v) => v != null && v !== '');
  const counts = new Map();
  for (const v of cards) counts.set(v, (counts.get(v) ?? 0) + 1);
  const distribution = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

  const rank = (card) => {
    if (UNDECIDED_CARDS.includes(card)) return null;
    if (Array.isArray(deck) && deck.length > 0) {
      const i = deck.indexOf(card);
      return i === -1 ? null : i;
    }
    if (card === SPLIT_CARD) return Number.MAX_SAFE_INTEGER;
    return cardNumber(card);
  };
  const ranked = cards.map((c) => ({ card: c, r: rank(c) })).filter((x) => x.r !== null);
  const acuerdo = cards.length > 0 && counts.size === 1 && !UNDECIDED_CARDS.includes(cards[0])
    ? cards[0]
    : null;
  let lowest = null;
  let highest = null;
  if (ranked.length > 0) {
    lowest = ranked.reduce((a, b) => (b.r < a.r ? b : a)).card;
    highest = ranked.reduce((a, b) => (b.r > a.r ? b : a)).card;
  }
  return {
    total: cards.length,
    distribution,
    consensus: acuerdo !== null,
    // El valor acordado, para guardarlo sin volver a deducirlo: solo existe con acuerdo.
    agreed: acuerdo,
    // La más baja y la más alta (iguales si hay acuerdo): por ahí empieza el debate.
    lowest,
    highest,
  };
}
