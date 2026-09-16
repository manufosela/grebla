import { describe, it, expect } from 'vitest';
import { hasVotedThisRound, countVoted, allVoted, revealedVotes, summarizeVotes, isSpectator, hasSkippedRound, activeVoters, countActiveVoted } from './tally.js';

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
      { uid: 'a', name: 'a', value: '8', axes: null },
      { uid: 'b', name: 'b', value: '13', axes: null },
    ]);
  });

  it('ignora votos de rondas anteriores aunque el voto exista', () => {
    const stale = { a: { value: '8', round: 4 } };
    expect(revealedVotes([player('a', 5)], stale, 5)).toEqual([{ uid: 'a', name: 'a', value: null, axes: null }]);
  });

  it('funciona igual con un Map', () => {
    const map = new Map([['a', { value: '20', round: 5 }]]);
    expect(revealedVotes([player('a', 5)], map, 5)).toEqual([{ uid: 'a', name: 'a', value: '20', axes: null }]);
  });

  it('un voto por ejes trae complejidad y esfuerzo: el debate empieza por descomponer la carta', () => {
    const conEjes = { a: { value: '8', round: 5, axes: { complexity: 5, effort: 1, extra: 'no' } } };
    expect(revealedVotes([player('a', 5)], conEjes, 5)).toEqual([
      { uid: 'a', name: 'a', value: '8', axes: { complexity: 5, effort: 1 } },
    ]);
  });
});

describe('summarizeVotes', () => {
  it('reparte la distribución, ordenada por frecuencia', () => {
    const s = summarizeVotes(['8', '8', '13', '5']);
    expect(s.total).toBe(4);
    expect(s.distribution[0]).toEqual({ value: '8', count: 2 });
  });

  it('promedia solo las numéricas e ignora las especiales', () => {
    const s = summarizeVotes(['2', '4' /* fuera de mazo pero numérica */, '?', '☕']);
    expect(s.numericCount).toBe(2);
    expect(s.min).toBe(2);
    expect(s.max).toBe(4);
    expect(s.average).toBe(3);
    expect(s.consensus).toBe(false);
  });

  it('detecta consenso cuando todas son iguales', () => {
    const s = summarizeVotes(['5', '5', '5']);
    expect(s.consensus).toBe(true);
    expect(s.average).toBe(5);
  });

  it('sin cartas no hay consenso ni medias', () => {
    const s = summarizeVotes([]);
    expect(s).toEqual({ total: 0, distribution: [], numericCount: 0, min: null, max: null, average: null, consensus: false, agreed: null });
  });

  it('solo especiales: ni medias ni consenso, aunque sean la misma', () => {
    // Este test decía lo contrario hasta RMR-TSK-0482: bastaba con que las
    // cartas coincidieran. Coincidir en «paremos» no es haber estimado nada, y
    // cantarlo como consenso hacía dar por cerrada una votación vacía.
    const s = summarizeVotes(['☕', '☕']);
    expect(s.numericCount).toBe(0);
    expect(s.average).toBeNull();
    expect(s.consensus).toBe(false);
  });
});

/**
 * Qué cuenta como ACUERDO (RMR-TSK-0482).
 *
 * Hasta ahora bastaba con que las cartas coincidieran, así que un equipo entero
 * votando «?» —nadie lo sabe— veía «¡Consenso! Todas las cartas coinciden». Una
 * carta especial dice «no lo sé» o «paremos»: coincidir en no saber no es estar
 * de acuerdo en nada.
 */
describe('acuerdo: qué se puede dar por estimado', () => {
  it('todas iguales y con significado: hay acuerdo, y se sabe en cuánto', () => {
    const s = summarizeVotes(['5', '5', '5']);
    expect(s.consensus).toBe(true);
    expect(s.agreed).toBe('5');
  });

  it('una talla también es un acuerdo: no todo se mide en números', () => {
    // La distinción es especial vs. no especial, no numérica vs. no numérica:
    // «todos decimos M» es tan acuerdo como «todos decimos 5».
    const s = summarizeVotes(['M', 'M']);
    expect(s.consensus).toBe(true);
    expect(s.agreed).toBe('M');
  });

  it('coincidir en «no lo sé» NO es un acuerdo', () => {
    for (const especial of ['?', '☕']) {
      const s = summarizeVotes([especial, especial, especial]);
      expect(s.consensus).toBe(false);
      expect(s.agreed).toBeNull();
    }
  });

  it('una sola carta especial rompe el acuerdo de los demás', () => {
    // Si alguien no lo sabe, el equipo todavía no ha estimado.
    const s = summarizeVotes(['5', '5', '?']);
    expect(s.consensus).toBe(false);
    expect(s.agreed).toBeNull();
  });

  it('sin unanimidad no hay nada que guardar, por cerca que se quede', () => {
    expect(summarizeVotes(['3', '5']).agreed).toBeNull();
    expect(summarizeVotes(['M', 'L']).agreed).toBeNull();
  });

  it('sin cartas no hay acuerdo que inventar', () => {
    expect(summarizeVotes([]).agreed).toBeNull();
    expect(summarizeVotes(null).agreed).toBeNull();
  });
});
