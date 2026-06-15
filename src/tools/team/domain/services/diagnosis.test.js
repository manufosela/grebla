import { describe, it, expect } from 'vitest';
import { diagnoseTeam, PENALTY } from './diagnosis.js';

const health = {
  teamSize: 3,
  busFactor: [
    { areaId: 'a', count: 0, atRisk: true },
    { areaId: 'b', count: 1, atRisk: true },
    { areaId: 'c', count: 3, atRisk: false },
  ],
  uncoveredRoles: [{ sigla: 'CF', name: 'Finalizador' }],
  silenceCount: 2,
};

describe('diagnoseTeam', () => {
  it('genera gaps por prioridad con su palanca', () => {
    const { gaps, counts } = diagnoseTeam(health);
    expect(counts).toEqual({ critical: 2, medium: 2, low: 1 });
    expect(gaps[0].severity).toBe('critical'); // ordenado por severidad
    expect(gaps.find((g) => g.kind === 'busFactorZero').areaId).toBe('a');
    expect(gaps.find((g) => g.kind === 'uncoveredRole').sigla).toBe('CF');
    expect(gaps.every((g) => typeof g.lever === 'string')).toBe(true);
  });

  it('calcula el score con las penalizaciones explícitas', () => {
    const { healthScore } = diagnoseTeam(health);
    // 100 - 15(bf0) - 10(bf1) - 3(1 rol) - 6(2 silencios) - 5(tamaño<5) = 61
    const expected =
      100 - PENALTY.busFactorZero - PENALTY.busFactorOne - PENALTY.uncoveredRole - 2 * PENALTY.silencePerPerson - PENALTY.sizeSmall;
    expect(healthScore).toBe(expected);
  });

  it('equipo sano sin gaps puntúa 100', () => {
    const { healthScore, gaps } = diagnoseTeam({ teamSize: 6, busFactor: [{ areaId: 'a', count: 3, atRisk: false }], uncoveredRoles: [], silenceCount: 0 });
    expect(healthScore).toBe(100);
    expect(gaps).toEqual([]);
  });

  it('el score nunca baja de 0', () => {
    const bad = {
      teamSize: 2,
      busFactor: Array.from({ length: 10 }, (_, i) => ({ areaId: `a${i}`, count: 0, atRisk: true })),
      uncoveredRoles: [{ sigla: 'X', name: 'X' }],
      silenceCount: 9,
    };
    expect(diagnoseTeam(bad).healthScore).toBe(0);
  });
});
