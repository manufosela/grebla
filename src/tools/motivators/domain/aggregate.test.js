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
    // minCount: 1 para poder ver el desglose fino; el umbral real (3) se prueba
    // en el bloque de anonimato de más abajo.
    const agg = computeAggregates(sessions, IDS, { game: 'g', orderedRoundIds: ['r1', 'r2'], size, minCount: 1 });

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

describe('computeAggregates — umbral de anonimato (RMR-BUG-0051)', () => {
  /** Tres sesiones de L1 (llega al umbral) y una sola de SOLO (no llega). */
  const sessions = [
    sess('r1', 'L1', [['a', 1], ['b', 2], ['c', 3]]),
    sess('r1', 'L1', [['a', 1], ['b', 3], ['c', 2]]),
    sess('r1', 'L1', [['a', 2], ['b', 1], ['c', 3]]),
    sess('r2', 'SOLO', [['a', 3], ['b', 1], ['c', 2]]),
  ];

  it('NO publica el corte de un equipo por debajo del umbral', () => {
    // Con una sola sesión, `distribution` y `averagePosition` reconstruyen el
    // orden exacto que eligió esa persona: publicar el bloque la identifica.
    const agg = computeAggregates(sessions, IDS, { game: 'g', size });
    expect(agg.byLeader.L1).toBeDefined();
    expect(agg.byLeader.SOLO).toBeUndefined();
  });

  it('NO publica una ronda por debajo del umbral', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size });
    expect(agg.byRound.r1).toBeDefined();
    expect(agg.byRound.r2).toBeUndefined();
  });

  it('la evolución salta las rondas retenidas en vez de romperse', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', orderedRoundIds: ['r1', 'r2'], size });
    expect(agg.evolution.a.map((p) => p.roundId)).toEqual(['r1']);
  });

  it('el global por debajo del umbral conserva el recuento pero no los datos', () => {
    const twoOnly = sessions.slice(0, 2);
    const agg = computeAggregates(twoOnly, IDS, { game: 'g', size });
    expect(agg.global.respondents).toBe(2); // cuántos respondieron sí se sabe
    expect(agg.global.ranking.every((s) => s.averagePosition === null)).toBe(true);
    expect(agg.global.byMotivator.a.distribution.every((n) => n === 0)).toBe(true);
  });

  it('publica el umbral aplicado para que la interfaz pueda explicarlo', () => {
    expect(computeAggregates(sessions, IDS, { game: 'g', size }).minCount).toBe(3);
  });

  it('permite bajar el umbral explícitamente (arneses y tests)', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size, minCount: 1 });
    expect(agg.byLeader.SOLO).toBeDefined();
  });
});

describe('computeAggregates — corte por departamento (RMR-TSK-0296)', () => {
  // L1 y L2 son managers del mismo departamento; L3 es de otro.
  const departmentByLeader = { L1: 'Tecnología', L2: 'Tecnología', L3: 'Ventas' };
  const sessions = [
    sess('r1', 'L1', [['a', 1], ['b', 2], ['c', 3]]),
    sess('r1', 'L2', [['a', 1], ['b', 3], ['c', 2]]),
    sess('r1', 'L2', [['a', 2], ['b', 1], ['c', 3]]),
    sess('r1', 'L3', [['a', 3], ['b', 1], ['c', 2]]),
  ];

  it('agrupa los equipos de un mismo departamento en un solo corte', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size, departmentByLeader });
    expect(agg.byDepartment['Tecnología'].respondents).toBe(3); // L1 + L2
  });

  it('hereda el umbral: un departamento pequeño NO se publica', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size, departmentByLeader });
    expect(agg.byDepartment.Ventas).toBeUndefined(); // L3 solo tiene 1
  });

  it('sin mapa de departamentos no hay corte, pero nada se rompe', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size });
    expect(agg.byDepartment).toEqual({});
  });

  it('un equipo que no cuelga de ningún departamento no inventa uno', () => {
    const agg = computeAggregates(sessions, IDS, { game: 'g', size, departmentByLeader: { L1: 'Tecnología' } });
    expect(Object.keys(agg.byDepartment)).toEqual([]); // L1 solo tiene 1 respuesta
  });
});

describe('computeAggregates — departamento fantasma (verificación del review)', () => {
  it('varios equipos SIN departamento no crean un corte fantasma aunque superen el umbral', () => {
    const huerfanas = [
      sess('r1', 'X1', [['a', 1], ['b', 2], ['c', 3]]),
      sess('r1', 'X2', [['a', 1], ['b', 2], ['c', 3]]),
      sess('r1', 'X3', [['a', 1], ['b', 2], ['c', 3]]),
    ];
    const agg = computeAggregates(huerfanas, IDS, { game: 'g', size, departmentByLeader: {} });
    expect(Object.keys(agg.byDepartment)).toEqual([]);
  });
});
