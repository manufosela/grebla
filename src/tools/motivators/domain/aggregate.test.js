import { describe, it, expect } from 'vitest';
import { aggregateBlock, computeAggregates } from './aggregate.js';

const IDS = ['a', 'b', 'c'];
const size = 3;

/** Sesión mínima: orden como pares [motivadorId, posicion]. */
const sess = (roundId, equipoId, pairs) => ({
  game: 'g', roundId, equipoId, usuarioId: `${roundId}-${equipoId}-${Math.round(pairs[0][1] * 1000)}`,
  orden: pairs.map(([motivadorId, posicion]) => ({ motivadorId, posicion })),
});

describe('aggregateBlock', () => {
  it('calcula media, mediana, top3, distribución y respondientes', () => {
    const sessions = [
      sess('r1', 'L1', [['a', 1], ['b', 2], ['c', 3]]),
      sess('r1', 'L1', [['a', 1], ['b', 3], ['c', 2]]),
      sess('r1', 'L2', [['a', 3], ['b', 1], ['c', 2]]),
    ];
    const block = aggregateBlock(sessions, IDS, size);
    expect(block.respondents).toBe(3);
    expect(block.byMotivator.a.averagePosition).toBeCloseTo(1.7, 1); // (1+1+3)/3
    expect(block.byMotivator.a.top3Count).toBe(3);
    expect(block.byMotivator.a.top3Pct).toBe(100);
    // 'a': dos veces posición 1, una vez posición 3 → distribución [2,0,1]
    expect(block.byMotivator.a.distribution).toEqual([2, 0, 1]);
  });

  it('ranking ordena por posición media ascendente; sin datos al final', () => {
    const sessions = [
      sess('r1', 'L1', [['a', 1], ['b', 2], ['c', 3]]),
    ];
    // 'a' media 1, 'b' media 2, 'c' media 3
    const block = aggregateBlock(sessions, IDS, size);
    expect(block.ranking.map((s) => s.motivadorId)).toEqual(['a', 'b', 'c']);

    const none = aggregateBlock([], IDS, size);
    expect(none.ranking.every((s) => s.averagePosition === null)).toBe(true);
  });
});

describe('computeAggregates', () => {
  it('desglosa global, por ronda, por equipo y evolución temporal', () => {
    const sessions = [
      sess('r1', 'L1', [['a', 1], ['b', 2], ['c', 3]]),
      sess('r2', 'L1', [['a', 3], ['b', 2], ['c', 1]]),
      sess('r2', 'L2', [['a', 3], ['b', 1], ['c', 2]]),
    ];
    const agg = computeAggregates(sessions, IDS, { game: 'g', orderedRoundIds: ['r1', 'r2'], size });

    expect(agg.respondents).toBe(3);
    expect(agg.byRound.r1.respondents).toBe(1);
    expect(agg.byRound.r2.respondents).toBe(2);
    expect(agg.byLeader.L1.respondents).toBe(2);
    expect(agg.byLeader.L2.respondents).toBe(1);

    // evolución de 'a': r1 media 1, r2 media 3
    expect(agg.evolution.a).toEqual([
      { roundId: 'r1', averagePosition: 1 },
      { roundId: 'r2', averagePosition: 3 },
    ]);
  });

  it('sin sesiones no rompe', () => {
    const agg = computeAggregates([], IDS, { game: 'g', size });
    expect(agg.respondents).toBe(0);
    expect(agg.global.ranking).toHaveLength(3);
  });
});
