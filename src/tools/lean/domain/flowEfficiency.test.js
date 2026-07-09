import { describe, it, expect } from 'vitest';
import { activeAndTotal, flowEfficiency } from './flowEfficiency.js';

const H = 3_600_000;
const base = new Date('2026-01-01T00:00:00Z').getTime();
const at = (h) => new Date(base + h * H).toISOString();

describe('activeAndTotal', () => {
  it('todo el tiempo en started → activo == total', () => {
    const r = activeAndTotal({ startedAt: at(0), completedAt: at(10), transitions: [] });
    expect(r.activeMs).toBe(10 * H);
    expect(r.totalMs).toBe(10 * H);
  });

  it('con una espera (started→review→started→completed)', () => {
    // 0-2h started, 2-8h review (espera), 8-10h started → activo 4h de 10h
    const issue = {
      startedAt: at(0),
      completedAt: at(10),
      transitions: [
        { stateType: 'started', at: at(0) },
        { stateType: 'unstarted', at: at(2) }, // vuelve a espera (review parado)
        { stateType: 'started', at: at(8) },
      ],
    };
    const r = activeAndTotal(issue);
    expect(r.activeMs).toBe(4 * H);
    expect(r.totalMs).toBe(10 * H);
  });

  it('sin started/completed válidos → 0', () => {
    expect(activeAndTotal({ startedAt: at(5), completedAt: at(2) })).toEqual({ activeMs: 0, totalMs: 0 });
  });
});

describe('flowEfficiency', () => {
  it('agrega Σactivo/Σtotal en %', () => {
    const issues = [
      { startedAt: at(0), completedAt: at(10), transitions: [{ stateType: 'started', at: at(0) }, { stateType: 'unstarted', at: at(2) }, { stateType: 'started', at: at(8) }] }, // 4/10
      { startedAt: at(0), completedAt: at(10), transitions: [] }, // 10/10
    ];
    // (4 + 10) / (10 + 10) = 70 %
    expect(flowEfficiency(issues)).toBe(70);
  });

  it('sin datos → null', () => {
    expect(flowEfficiency([])).toBeNull();
  });
});
