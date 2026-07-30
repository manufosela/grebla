import { describe, it, expect } from 'vitest';
import {
  slugifySquad, doraCurrent, leanCurrent, calcFailed, hasAnyNumber, accumulateSeries, buildSnapshot,
} from './snapshot.js';

describe('slugifySquad', () => {
  it('normaliza a un slug estable', () => {
    expect(slugifySquad('The Mario-netas')).toBe('the-mario-netas');
    expect(slugifySquad('Diseño & Producto')).toBe('diseno-producto');
    expect(slugifySquad('  Plataforma  ')).toBe('plataforma');
  });
});

describe('doraCurrent (unidades)', () => {
  it('mapea con lead time real, CFR a fracción y MTTR en horas', () => {
    const agg = { deployFrequencyPerWeek: 4.3, leadTimeCommitDeployHoursAvg: 18, changeFailureRatePct: 8, mttrHoursAvg: 3.1 };
    expect(doraCurrent(agg)).toEqual({ deploymentFrequency: 4.3, leadTimeForChanges: 18, changeFailureRate: 0.08, timeToRestore: 3.1 });
  });
  it('cae al lead time de PR si no hay lead time real, y deja null lo ausente', () => {
    const agg = { deployFrequencyPerWeek: 2, leadTimeCommitDeployHoursAvg: null, leadTimeHoursAvg: 26, changeFailureRatePct: null, mttrHoursAvg: null };
    expect(doraCurrent(agg)).toEqual({ deploymentFrequency: 2, leadTimeForChanges: 26, changeFailureRate: null, timeToRestore: null });
  });
});

describe('leanCurrent', () => {
  it('mapea cycle p50, throughput y wip; flowEfficiency null (GREBLA no lo calcula)', () => {
    const m = { cycleTimeP50Hours: 29, throughputPerWeek: 11, wip: 6 };
    expect(leanCurrent(m)).toEqual({ cycleTime: 29, throughput: 11, wip: 6, flowEfficiency: null });
  });
});

describe('calcFailed / hasAnyNumber', () => {
  it('detecta un cálculo fallido o ausente', () => {
    expect(calcFailed(null)).toBe(true);
    expect(calcFailed({ error: 'timeout' })).toBe(true);
    expect(calcFailed({ throughputPerWeek: 3 })).toBe(false);
  });
  it('hasAnyNumber es falso si todo es null', () => {
    expect(hasAnyNumber({ a: null, b: null })).toBe(false);
    expect(hasAnyNumber({ a: null, b: 0 })).toBe(true);
  });
});

describe('accumulateSeries', () => {
  it('reemplaza el punto de la misma semana (idempotente) y ordena', () => {
    const prev = [{ periodStart: '2026-06-16', throughput: 7 }];
    const out = accumulateSeries(prev, { periodStart: '2026-06-16', throughput: 9 });
    expect(out).toEqual([{ periodStart: '2026-06-16', throughput: 9 }]);
  });
  it('añade semanas nuevas y conserva solo las últimas 8', () => {
    const prev = Array.from({ length: 8 }, (_, i) => ({ periodStart: `2026-01-0${i + 1}`, v: i }));
    const out = accumulateSeries(prev, { periodStart: '2026-02-01', v: 99 });
    expect(out).toHaveLength(8);
    expect(out.at(-1)).toEqual({ periodStart: '2026-02-01', v: 99 });
    expect(out[0].periodStart).toBe('2026-01-02'); // se cae la más antigua
  });
});

describe('buildSnapshot', () => {
  it('ensambla el doc con el esquema del portal y la serie acumulada', () => {
    const snap = buildSnapshot({
      squad: 'the-mario-netas', updatedAt: '2026-07-28T06:00:00Z', periodStart: '2026-07-27',
      current: { deploymentFrequency: 4.3, leadTimeForChanges: 18, changeFailureRate: 0.08, timeToRestore: 3.1 },
      prevSeries: [{ periodStart: '2026-06-16', deploymentFrequency: 3.2 }],
    });
    expect(snap.squad).toBe('the-mario-netas');
    expect(snap.period).toBe('weekly');
    expect(snap.current.deploymentFrequency).toBe(4.3);
    expect(snap.series).toHaveLength(2);
    expect(snap.series.at(-1)).toMatchObject({ periodStart: '2026-07-27', deploymentFrequency: 4.3 });
  });
});
