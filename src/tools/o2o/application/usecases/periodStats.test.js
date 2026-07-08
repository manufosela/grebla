import { describe, it, expect } from 'vitest';
import { coverageOf, evolutionOf } from './periodStats.js';

const people = [{ id: 'ana', name: 'Ana' }, { id: 'leo', name: 'Leo' }, { id: 'sam', name: 'Sam' }];

describe('coverageOf', () => {
  it('cuenta personas del equipo con ≥1 sesión', () => {
    const sessions = [
      { personId: 'ana', periodId: 'p1' },
      { personId: 'ana', periodId: 'p1' }, // misma persona no cuenta doble
      { personId: 'leo', periodId: 'p1' },
    ];
    const cov = coverageOf(sessions, people);
    expect(cov.done).toBe(2);
    expect(cov.total).toBe(3);
    expect(cov.pct).toBe(67);
    expect(cov.doneIds.has('ana')).toBe(true);
    expect(cov.doneIds.has('sam')).toBe(false);
  });

  it('ignora sesiones de personas que no están en el equipo', () => {
    const cov = coverageOf([{ personId: 'externo' }], people);
    expect(cov.done).toBe(0);
  });

  it('equipo vacío → 0% sin dividir por cero', () => {
    expect(coverageOf([], []).pct).toBe(0);
  });
});

describe('evolutionOf', () => {
  it('da la cobertura de cada periodo', () => {
    const periods = [{ id: 'jul', name: 'Julio' }, { id: 'sep', name: 'Septiembre' }];
    const allSessions = [
      { personId: 'ana', periodId: 'jul' },
      { personId: 'ana', periodId: 'sep' },
      { personId: 'leo', periodId: 'sep' },
      { personId: 'sam', periodId: 'sep' },
    ];
    const evo = evolutionOf(periods, allSessions, people);
    expect(evo).toHaveLength(2);
    expect(evo[0]).toMatchObject({ name: 'Julio', done: 1, total: 3, sessions: 1 });
    expect(evo[1]).toMatchObject({ name: 'Septiembre', done: 3, total: 3, pct: 100, sessions: 3 });
  });
});
