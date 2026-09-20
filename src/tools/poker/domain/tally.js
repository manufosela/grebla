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
// ── Gremio del asiento (RMR-PCS-0043 · F2) ───────────────────────────────────
// El asiento lleva los gremios de la ficha (o los que asignó el organizador).
// En una tarea con gremios solo votan los asientos de esos gremios; una tarea
// sin gremios es general y votan todos.

/** @returns {string[]} gremios del asiento */
export function seatGuilds(player) {
  return Array.isArray(player?.guilds) ? player.guilds : [];
}

/**
 * Gremios que trae la FICHA de quien se sentó, separados de los que se eligieron
 * a mano durante la sesión (RMR-BUG-0127). En asientos anteriores al campo, los
 * del asiento: entonces no había elección a mano que distinguir.
 * @returns {string[]}
 */
export function baseGuilds(player) {
  return Array.isArray(player?.baseGuilds) ? player.baseGuilds : seatGuilds(player);
}

/**
 * El asiento después de elegir gremio, partiendo SIEMPRE de la ficha y no del
 * asiento: así una elección equivocada se corrige eligiendo otra (antes se
 * acumulaban y el error se quedaba pegado al asiento para siempre). Sin gremio
 * (null), el asiento vuelve a lo que dice la ficha.
 * @param {{guilds?: string[], baseGuilds?: string[]}} player
 * @param {string|null} guild
 * @returns {string[]}
 */
export function assignSeatGuilds(player, guild) {
  const base = baseGuilds(player);
  return guild && !base.includes(guild) ? [...base, guild] : [...base];
}

/**
 * Al volver a entrar, el asiento refresca los gremios de la ficha sin tirar el
 * que se eligió a mano (recargar la página no deshace la elección).
 * @param {{guilds?: string[], baseGuilds?: string[]}|null} player  el asiento anterior
 * @param {string[]} fichaGuilds  los gremios que trae la ficha ahora
 * @returns {string[]}
 */
export function refreshSeatGuilds(player, fichaGuilds) {
  const base = baseGuilds(player);
  const aMano = seatGuilds(player).filter((g) => !base.includes(g));
  return [...new Set([...(fichaGuilds ?? []), ...aMano])];
}

/** @returns {string[]} gremios de la tarea (vacío = general) */
function taskGuildList(task) {
  return Array.isArray(task?.guilds) ? task.guilds : [];
}

/**
 * Gremios con los que ESTE asiento puede votar ESTA tarea (intersección). En
 * una tarea general no hay gremio que elegir: vacío.
 */
export function guildsForTask(player, task, locked = {}) {
  const all = taskGuildList(task);
  if (all.length === 0) return [];
  const abiertos = all.filter((g) => !isLocked(locked, g));
  return seatGuilds(player).filter((g) => abiertos.includes(g));
}

/** ¿Está ese gremio FIJADO (ya con acuerdo) en esta tarea? (RMR-PCS-0043 · F3) */
export function isLocked(locked, guild) {
  return !!locked && typeof locked === 'object' && Object.hasOwn(locked, guild);
}

/**
 * ¿Puede votar esta tarea? Tarea general, todos; con gremios, solo quien tiene
 * alguno que todavía no esté fijado.
 */
export function eligibleFor(player, task, locked = {}) {
  return taskGuildList(task).length === 0 || guildsForTask(player, task, locked).length > 0;
}

/**
 * Con qué gremio cuenta el voto sin preguntar: el único posible. Con varios,
 * null (hay que elegir); en tarea general, null (no aplica).
 */
export function impliedGuild(player, task, locked = {}) {
  const g = guildsForTask(player, task, locked);
  return g.length === 1 ? g[0] : null;
}

/** Votantes activos de la ronda; con `task`, solo los elegibles para ella (sin los gremios fijados). */
export function activeVoters(players, round, task = null, locked = {}) {
  return (players ?? []).filter((p) => !isSpectator(p) && !hasSkippedRound(p, round) && (task === null || eligibleFor(p, task, locked)));
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
export function revealedVotes(players, votesByUid, round, task = null, locked = {}) {
  return activeVoters(players, round, task, locked)
    .filter((p) => hasVotedThisRound(p, round))
    .map((p) => {
      const vote = voteFor(votesByUid, p.uid);
      const actual = vote?.round === round;
      return {
        uid: p.uid,
        name: p.name ?? '',
        value: actual ? vote.value : null,
        axes: actual && vote.axes ? { complexity: vote.axes.complexity, effort: vote.axes.effort } : null,
        guild: actual && typeof vote.guild === 'string' ? vote.guild : null,
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

/**
 * El juicio POR GREMIO (RMR-PCS-0043 · F3): los votos revelados se agrupan por
 * el gremio con el que se emitieron y cada grupo se juzga aparte con
 * `judgeVotes`. Los votos sin gremio (tarea general) forman un solo grupo con
 * gremio null. `agreed` recoge el valor de cada gremio que coincide.
 * @param {Array<{ guild?: string|null, value: string|null }>} votes
 * @param {string[]} deck
 * @returns {{ groups: Array<{ guild: string|null, votes: any[], verdict: ReturnType<typeof judgeVotes> }>, agreed: Record<string, string>, allAgreed: boolean }}
 */
export function judgeByGuild(votes, deck) {
  const byGuild = new Map();
  for (const v of votes ?? []) {
    const key = typeof v.guild === 'string' && v.guild ? v.guild : null;
    if (!byGuild.has(key)) byGuild.set(key, []);
    byGuild.get(key).push(v);
  }
  const groups = [...byGuild.entries()]
    .map(([guild, list]) => ({ guild, votes: list, verdict: judgeVotes(list.map((v) => v.value), deck) }))
    .sort((a, b) => String(a.guild ?? '').localeCompare(String(b.guild ?? ''), 'es'));
  const agreed = Object.fromEntries(groups.filter((g) => g.verdict.consensus).map((g) => [g.guild ?? '', g.verdict.agreed]));
  return { groups, agreed, allAgreed: groups.length > 0 && groups.every((g) => g.verdict.consensus) };
}

/**
 * ¿Están todos los gremios de la tarea con valor, entre los fijados y los que
 * acaban de coincidir? Y cuáles faltan (sin acuerdo o sin nadie en la mesa).
 * @param {{ guilds?: string[] }} task
 * @param {Record<string, string>} locked
 * @param {Record<string, string>} agreed
 * @returns {{ done: boolean, values: Record<string, string>, missing: string[] }}
 */
export function taskSettlement(task, locked = {}, agreed = {}) {
  const guilds = Array.isArray(task?.guilds) ? task.guilds : [];
  const values = {};
  const missing = [];
  for (const g of guilds) {
    if (isLocked(locked, g)) values[g] = locked[g];
    else if (Object.hasOwn(agreed ?? {}, g)) values[g] = agreed[g];
    else missing.push(g);
  }
  return { done: guilds.length > 0 && missing.length === 0, values, missing };
}
