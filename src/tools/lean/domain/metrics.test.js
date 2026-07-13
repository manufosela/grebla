import { describe, it, expect } from 'vitest';
import { computeFlowMetrics, percentile } from './metrics.js';

describe('percentile', () => {
  it('interpola linealmente y tolera casos límite', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([5], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([24, 48], 0.85)).toBeCloseTo(44.4, 5);
  });
});

describe('computeFlowMetrics', () => {
  const H = 3_600_000;
  const D = 24 * H;
  const from = '2026-01-01T00:00:00Z';
  const to = '2026-01-29T00:00:00Z'; // 4 semanas exactas
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const iso = (t) => new Date(t).toISOString();

  it('calcula throughput, cycle time (p50) y WIP/aging', () => {
    const issues = [
      { id: 'a', stateType: 'completed', createdAt: from, startedAt: iso(fromMs), completedAt: iso(fromMs + 2 * D) }, // cycle 48h
      { id: 'b', stateType: 'completed', createdAt: from, startedAt: iso(fromMs + 5 * D), completedAt: iso(fromMs + 6 * D) }, // cycle 24h
      { id: 'c', stateType: 'started', createdAt: from, startedAt: iso(toMs - 3 * D) }, // WIP aging 3 días
      { id: 'd', stateType: 'backlog', createdAt: from }, // no cuenta
    ];
    const m = computeFlowMetrics(issues, { from, to });
    expect(m.completed).toBe(2);
    expect(m.throughputPerWeek).toBe(0.5); // 2 / 4 semanas
    expect(m.cycleTimeP50Hours).toBe(36); // p50 de [24, 48]
    expect(m.cycleTimeP85Hours).toBeCloseTo(44.4, 1);
    expect(m.wip).toBe(1);
    expect(m.agingDaysMax).toBe(3);
  });

  it('oldestWip: las 3 issues en curso más antiguas, ordenadas por antigüedad, con enlace', () => {
    const wip = (n, days) => ({ id: `w${n}`, stateType: 'started', createdAt: from, startedAt: iso(toMs - days * D), identifier: `T-${n}`, url: `https://linear.app/x/T-${n}`, title: `Issue ${n}` });
    const issues = [
      wip(1, 10), wip(2, 2), wip(3, 5), wip(4, 7),
      { id: 'done', stateType: 'completed', createdAt: from, startedAt: from, completedAt: iso(fromMs + D) }, // no cuenta
    ];
    const m = computeFlowMetrics(issues, { from, to });
    expect(m.oldestWip.map((o) => o.identifier)).toEqual(['T-1', 'T-4', 'T-3']); // top 3 por días desc
    expect(m.oldestWip[0]).toEqual({ identifier: 'T-1', url: 'https://linear.app/x/T-1', title: 'Issue 1', agingDays: 10 });
  });

  it('oldestWip vacío si no hay issues en curso', () => {
    const issues = [{ id: 'c', stateType: 'completed', createdAt: from, startedAt: from, completedAt: iso(fromMs + D) }];
    expect(computeFlowMetrics(issues, { from, to }).oldestWip).toEqual([]);
  });

  it('sin issues → ceros/nulls sin romper', () => {
    const m = computeFlowMetrics([], { from, to });
    expect(m).toMatchObject({ completed: 0, throughputPerWeek: 0, cycleTimeP50Hours: null, wip: 0, agingDaysMax: null, agingDaysAvg: 0 });
  });

  it('completadas fuera de la ventana no cuentan', () => {
    const issues = [{ id: 'x', stateType: 'completed', createdAt: from, startedAt: from, completedAt: '2025-12-01T00:00:00Z' }];
    expect(computeFlowMetrics(issues, { from, to }).completed).toBe(0);
  });
});
