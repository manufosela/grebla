import { describe, it, expect } from 'vitest';
import { hasVotedThisRound, countVoted, allVoted, revealedVotes, judgeVotes, isSpectator, hasSkippedRound, activeVoters, countActiveVoted, seatGuilds, guildsForTask, eligibleFor, impliedGuild } from './tally.js';

const player = (uid, votedRound) => ({ uid, name: uid, votedRound });

describe('hasVotedThisRound', () => {
  it('cuenta el voto solo si es de la ronda actual', () => {
    expect(hasVotedThisRound(player('a', 2), 2)).toBe(true);
    expect(hasVotedThisRound(player('a', 1), 2)).toBe(false); // voto obsoleto
    expect(hasVotedThisRound(player('a', undefined), 2)).toBe(false); // aún no votó
  });

  it('sin jugador es falso', () => {
    expect(hasVotedThisRound(null, 2)).toBe(false);
  });
});

describe('countVoted', () => {
  it('cuenta solo los votos de la ronda actual', () => {
    const players = [player('a', 3), player('b', 3), player('c', 2), player('d', undefined)];
    expect(countVoted(players, 3)).toBe(2);
  });
});

describe('allVoted', () => {
  it('es falso si alguien no ha votado esta ronda', () => {
    expect(allVoted([player('a', 3), player('b', undefined)], 3)).toBe(false);
  });

  it('es cierto cuando todos los unidos votaron esta ronda', () => {
    expect(allVoted([player('a', 3), player('b', 3)], 3)).toBe(true);
  });

  it('es falso con la mesa vacía (no hay nada que revelar)', () => {
    expect(allVoted([], 3)).toBe(false);
  });

  it('al pasar de ronda vuelve a ser falso aunque votaran la anterior', () => {
    const players = [player('a', 3), player('b', 3)];
    expect(allVoted(players, 4)).toBe(false);
  });
});

describe('observador y fuera de ámbito', () => {
  it('isSpectator detecta el «solo ver»', () => {
    expect(isSpectator({ spectator: true })).toBe(true);
    expect(isSpectator({ spectator: false })).toBe(false);
    expect(isSpectator(null)).toBe(false);
  });
  it('hasSkippedRound solo cuenta la ronda actual', () => {
    expect(hasSkippedRound({ skippedRound: 3 }, 3)).toBe(true);
    expect(hasSkippedRound({ skippedRound: 2 }, 3)).toBe(false);
  });
  it('activeVoters excluye observadores y fuera de ámbito', () => {
    const players = [
      { uid: 'a', votedRound: 3 },
      { uid: 'b', spectator: true },
      { uid: 'c', skippedRound: 3 },
      { uid: 'd', skippedRound: 2 },
    ];
    expect(activeVoters(players, 3).map((p) => p.uid)).toEqual(['a', 'd']);
  });
  it('countActiveVoted no supera al total de activos (votó y luego observador)', () => {
    const players = [{ uid: 'a', votedRound: 3, spectator: true }, { uid: 'b', votedRound: 3 }];
    expect(countActiveVoted(players, 3)).toBe(1); // 'a' votó pero es observador → no cuenta
  });
  it('revealedVotes excluye el voto obsoleto de un observador', () => {
    const players = [{ uid: 'a', votedRound: 3, spectator: true }];
    expect(revealedVotes(players, { a: { value: '5', round: 3 } }, 3)).toEqual([]);
  });
});

describe('revealedVotes', () => {
  const players = [player('a', 5), player('b', 5), player('c', 4)];
  const votes = { a: { value: '8', round: 5 }, b: { value: '13', round: 5 }, c: { value: '3', round: 4 } };

  it('devuelve la carta de cada jugador que votó esta ronda', () => {
    expect(revealedVotes(players, votes, 5)).toEqual([
      { uid: 'a', name: 'a', value: '8', axes: null, guild: null },
      { uid: 'b', name: 'b', value: '13', axes: null, guild: null },
    ]);
  });

  it('ignora votos de rondas anteriores aunque el voto exista', () => {
    const stale = { a: { value: '8', round: 4 } };
    expect(revealedVotes([player('a', 5)], stale, 5)).toEqual([{ uid: 'a', name: 'a', value: null, axes: null, guild: null }]);
  });

  it('funciona igual con un Map', () => {
    const map = new Map([['a', { value: '20', round: 5 }]]);
    expect(revealedVotes([player('a', 5)], map, 5)).toEqual([{ uid: 'a', name: 'a', value: '20', axes: null, guild: null }]);
  });

  it('un voto por ejes trae complejidad y esfuerzo: el debate empieza por descomponer la carta', () => {
    const conEjes = { a: { value: '8', round: 5, axes: { complexity: 5, effort: 1, extra: 'no' } } };
    expect(revealedVotes([player('a', 5)], conEjes, 5)).toEqual([
      { uid: 'a', name: 'a', value: '8', axes: { complexity: 5, effort: 1 }, guild: null },
    ]);
  });
});

/**
 * Juicio de una votación (RMR-TSK-0521): acuerdo, o la más baja y la más alta.
 * Sin medias: la distancia entre extremos es la información que falta, y una
 * media la esconde.
 */
describe('judgeVotes', () => {
  const MAZO = ['1', '2', '3', '5', '8', '13', 'partir'];

  it('reparte la distribución, ordenada por frecuencia', () => {
    const s = judgeVotes(['8', '8', '13', '5'], MAZO);
    expect(s.total).toBe(4);
    expect(s.distribution[0]).toEqual({ value: '8', count: 2 });
  });

  it('todas iguales y con significado: acuerdo, y se sabe en cuánto', () => {
    const s = judgeVotes(['5', '5', '5'], MAZO);
    expect(s.consensus).toBe(true);
    expect(s.agreed).toBe('5');
    expect([s.lowest, s.highest]).toEqual(['5', '5']);
  });

  it('sin acuerdo señala la más baja y la más alta, sin media', () => {
    const s = judgeVotes(['3', '8', '5'], MAZO);
    expect(s.consensus).toBe(false);
    expect(s.agreed).toBeNull();
    expect(s.lowest).toBe('3');
    expect(s.highest).toBe('8');
    expect('average' in s).toBe(false);
  });

  it('«partir» está por encima de todo, y coincidir en partir SÍ es acuerdo: hay que partirla', () => {
    expect(judgeVotes(['13', 'partir'], MAZO).highest).toBe('partir');
    const s = judgeVotes(['partir', 'partir'], MAZO);
    expect(s.consensus).toBe(true);
    expect(s.agreed).toBe('partir');
  });

  it('una talla también es un acuerdo, y el orden lo da su mazo', () => {
    const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'partir'];
    expect(judgeVotes(['M', 'M'], TALLAS).agreed).toBe('M');
    const s = judgeVotes(['L', 'S', 'M'], TALLAS);
    expect(s.lowest).toBe('S');
    expect(s.highest).toBe('L');
  });

  it('las cartas antiguas «?» y «☕» no dicen nada: ni acuerdo ni extremo', () => {
    for (const especial of ['?', '☕']) {
      const s = judgeVotes([especial, especial], ['1', '2', '?', '☕']);
      expect(s.consensus).toBe(false);
      expect(s.agreed).toBeNull();
      expect(s.lowest).toBeNull();
    }
    // Una sola rompe el acuerdo de los demás: si alguien no lo sabe, no se ha estimado.
    expect(judgeVotes(['5', '5', '?'], ['5', '?']).consensus).toBe(false);
  });

  it('sin mazo, ordena por número con partir al final', () => {
    const s = judgeVotes(['8', '3', 'partir']);
    expect(s.lowest).toBe('3');
    expect(s.highest).toBe('partir');
  });

  it('sin cartas no hay nada que juzgar', () => {
    expect(judgeVotes([])).toEqual({ total: 0, distribution: [], consensus: false, agreed: null, lowest: null, highest: null });
    expect(judgeVotes(null).agreed).toBeNull();
  });
});

describe('gremio del asiento (RMR-PCS-0043 · F2)', () => {
  const ana = { uid: 'a', name: 'Ana', guilds: ['Backend PHP', 'QA'] };
  const bea = { uid: 'b', name: 'Bea', guilds: ['iOS'] };
  const sin = { uid: 's', name: 'Sin gremio' };
  const tarea = { id: 't', title: 'x', guilds: ['Backend PHP', 'QA'] };
  const general = { id: 'g', title: 'y', guilds: [] };

  it('seatGuilds y guildsForTask: la intersección con la tarea; en general, ninguno', () => {
    expect(seatGuilds(ana)).toEqual(['Backend PHP', 'QA']);
    expect(seatGuilds(sin)).toEqual([]);
    expect(guildsForTask(ana, tarea)).toEqual(['Backend PHP', 'QA']);
    expect(guildsForTask(bea, tarea)).toEqual([]);
    expect(guildsForTask(ana, general)).toEqual([]);
  });

  it('eligibleFor: tarea general para todos; con gremios, solo quien los tiene', () => {
    expect([ana, bea, sin].map((p) => eligibleFor(p, tarea))).toEqual([true, false, false]);
    expect([ana, bea, sin].map((p) => eligibleFor(p, general))).toEqual([true, true, true]);
    expect(eligibleFor(bea, { title: 'vieja sin campo' })).toBe(true);
  });

  it('impliedGuild: el único posible; con varios o en general, hay que elegir o no aplica', () => {
    expect(impliedGuild(bea, { guilds: ['iOS', 'QA'] })).toBe('iOS');
    expect(impliedGuild(ana, tarea)).toBeNull();
    expect(impliedGuild(ana, general)).toBeNull();
  });

  it('activeVoters y revealedVotes con tarea dejan fuera a quien no es del gremio, y el voto trae su gremio', () => {
    const players = [ana, bea, { ...sin, votedRound: 1 }, { ...ana, uid: 'a2', votedRound: 1 }];
    expect(activeVoters(players, 1, tarea).map((p) => p.uid)).toEqual(['a', 'a2']);
    expect(activeVoters(players, 1).map((p) => p.uid)).toEqual(['a', 'b', 's', 'a2']);
    const votos = { a2: { value: '5', round: 1, guild: 'QA' }, s: { value: '8', round: 1 } };
    expect(revealedVotes(players, votos, 1, tarea)).toEqual([{ uid: 'a2', name: 'Ana', value: '5', axes: null, guild: 'QA' }]);
    expect(revealedVotes(players, votos, 1).map((v) => [v.uid, v.guild])).toEqual([['s', null], ['a2', 'QA']]);
  });
});
