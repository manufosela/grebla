import { describe, it, expect } from 'vitest';
import { turnover } from './turnover.js';

const people = [
  { id: 'a', name: 'A', startDate: '2025-01-01', active: true, deactivatedAt: null },
  { id: 'b', name: 'B', startDate: '2025-01-01', active: false, deactivatedAt: '2025-06-15' },
  { id: 'c', name: 'C', startDate: '2025-07-01', active: true, deactivatedAt: null },
];

describe('turnover (rotación)', () => {
  it('cuenta altas y bajas dentro del periodo', () => {
    const r = turnover(people, { from: '2025-01-01', to: '2025-12-31' });
    expect(r.hires).toBe(3); // las 3 entraron en 2025
    expect(r.departures).toBe(1); // solo B causó baja
  });

  it('plantilla a inicio/fin y tasa de rotación', () => {
    const r = turnover(people, { from: '2025-06-01', to: '2025-12-31' });
    // 1 jun: A y B activos (C aún no) → 2; 31 dic: A y C → 2
    expect(r.headcountStart).toBe(2);
    expect(r.headcountEnd).toBe(2);
    expect(r.avgHeadcount).toBe(2);
    expect(r.departures).toBe(1);
    expect(r.turnoverRate).toBe(50); // 1 / 2 * 100
  });

  it('sin plantilla la tasa es 0', () => {
    const r = turnover([], { from: '2025-01-01', to: '2025-12-31' });
    expect(r.turnoverRate).toBe(0);
    expect(r.departures).toBe(0);
  });
});
