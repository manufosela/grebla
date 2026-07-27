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
import { cardNumber } from './deck.js';

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
 * @returns {Array<{uid:string,name:string,value:string|null}>}
 */
export function revealedVotes(players, votesByUid, round) {
  return (players ?? [])
    .filter((p) => hasVotedThisRound(p, round))
    .map((p) => {
      const vote = voteFor(votesByUid, p.uid);
      return { uid: p.uid, name: p.name ?? '', value: vote?.round === round ? vote.value : null };
    });
}

/**
 * Resumen de las cartas reveladas de la ronda: distribución (para ver el reparto
 * de un vistazo), min/max/media de las NUMÉRICAS (las especiales `?`/`☕` se
 * cuentan pero no promedian) y si hubo consenso (todas iguales).
 * @param {Array<string|null>} values
 */
export function summarizeVotes(values) {
  const cards = (values ?? []).filter((v) => v != null && v !== '');
  const counts = new Map();
  for (const v of cards) counts.set(v, (counts.get(v) ?? 0) + 1);
  const distribution = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

  const numbers = cards.map(cardNumber).filter((n) => n !== null);
  const hasNumbers = numbers.length > 0;
  return {
    total: cards.length,
    distribution,
    numericCount: numbers.length,
    min: hasNumbers ? Math.min(...numbers) : null,
    max: hasNumbers ? Math.max(...numbers) : null,
    average: hasNumbers ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : null,
    consensus: cards.length > 0 && counts.size === 1,
  };
}
