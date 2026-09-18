/**
 * La mesa de Scrum Poker (RMR-TSK-0523): una carta por persona que vota.
 * Dominio puro: dado lo que hay en la sesión, dice qué carta pintar y de qué
 * color, y la mesa solo pinta.
 *
 * Antes de revelar, cada carta está boca abajo y el borde verde dice «ya ha
 * votado». Al revelar se giran y el color cuenta el juicio: verde pastel en
 * todas si coinciden; si no, rojo pastel en la más baja y en la más alta (todas
 * las que tengan ese valor), que es por donde empieza el debate.
 *
 * @typedef {'hidden'|'agree'|'low'|'high'|'plain'|'empty'} SeatTone
 * @typedef {{ uid: string, name: string, voted: boolean, value: string|null, axes: {complexity:number, effort:number}|null, tone: SeatTone }} Seat
 */
import { activeVoters, hasVotedThisRound, judgeVotes, judgeByGuild, guildsForTask, impliedGuild, seatGuilds } from './tally.js';

/** ¿Han votado ya TODOS los que votan en esta ronda? (y hay al menos uno). */
/** Con `task` (RMR-PCS-0043 · F2) solo cuentan los asientos elegibles para ella. */
export function allActiveVoted(players, round, task = null, locked = {}) {
  const activos = activeVoters(players, round, task, locked);
  return activos.length > 0 && activos.every((p) => hasVotedThisRound(p, round));
}

/**
 * Los asientos de la mesa: quienes votan en la ronda (ni observadores ni fuera
 * de ámbito), en el orden en que se sentaron.
 *
 * @param {{ players: Array<object>, votesByUid?: Record<string, {value:string, round:number, axes?:object}>, round: number, revealed: boolean, deck?: ReadonlyArray<string> }} input
 * @returns {{ seats: Seat[], verdict: ReturnType<typeof judgeVotes>|null }}
 */
export function cardStates({ players, votesByUid = {}, round, revealed, deck, task = null, locked = {} }) {
  const activos = activeVoters(players, round, task, locked);
  const base = activos.map((p) => {
    const voted = hasVotedThisRound(p, round);
    const vote = votesByUid?.[p.uid];
    const actual = revealed && voted && vote?.round === round;
    // El gremio de la carta: el del voto si ya se ve; si no, el único posible del asiento para la tarea.
    const guild = (actual && typeof vote.guild === 'string' && vote.guild) || impliedGuild(p, task, locked);
    return {
      uid: p.uid,
      name: p.name || 'Sin nombre',
      voted,
      value: actual ? vote.value : null,
      axes: actual && vote.axes ? { complexity: vote.axes.complexity, effort: vote.axes.effort } : null,
      guild,
      guilds: task ? guildsForTask(p, task, locked) : seatGuilds(p),
    };
  });
  if (!revealed) return { seats: base.map((s) => ({ ...s, tone: 'hidden' })), verdict: null, byGuild: null };

  const verdict = judgeVotes(base.map((s) => s.value), deck);
  // Con gremios en la tarea, cada carta se juzga contra SU gremio (RMR-PCS-0043 · F3).
  const porGremio = (task?.guilds ?? []).length > 0;
  // Sin gremios en la tarea todo va a un grupo: el gremio del asiento no separa a nadie.
  const byGuild = judgeByGuild(base.filter((s) => s.value !== null).map((s) => ({ ...s, guild: porGremio ? s.guild : null })), deck);
  const verdictFor = (s) => (porGremio ? byGuild.groups.find((g) => g.guild === (s.guild ?? null))?.verdict ?? verdict : verdict);
  const tone = (s) => {
    if (s.value === null) return 'empty';
    const v = verdictFor(s);
    if (v.consensus) return 'agree';
    if (s.value === v.lowest) return 'low';
    if (s.value === v.highest) return 'high';
    return 'plain';
  };
  return { seats: base.map((s) => ({ ...s, tone: tone(s) })), verdict, byGuild };
}
