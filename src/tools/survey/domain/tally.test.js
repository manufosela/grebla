import { describe, it, expect } from 'vitest';
import { enpsCategory, enps, summarizeScale } from './tally.js';

describe('enpsCategory', () => {
  it('corta en 9–10 promotor, 7–8 pasivo, ≤6 detractor', () => {
    expect(enpsCategory(10)).toBe('promoter');
    expect(enpsCategory(9)).toBe('promoter');
    expect(enpsCategory(8)).toBe('passive');
    expect(enpsCategory(7)).toBe('passive');
    expect(enpsCategory(6)).toBe('detractor');
    expect(enpsCategory(1)).toBe('detractor');
  });
});

describe('enps', () => {
  it('es %promotores − %detractores', () => {
    // 2 promotores (9,10), 1 pasivo (8), 1 detractor (3) → (50 − 25) = 25
    expect(enps([9, 10, 8, 3])).toBe(25);
  });
  it('todo promotores da 100; todo detractores −100', () => {
    expect(enps([9, 10])).toBe(100);
    expect(enps([1, 2, 3])).toBe(-100);
  });
  it('sin puntuaciones es null', () => {
    expect(enps([])).toBeNull();
  });
});

describe('summarizeScale', () => {
  it('da n, media y distribución ordenada', () => {
    const s = summarizeScale([5, 4, 5, 3]);
    expect(s.n).toBe(4);
    expect(s.average).toBeCloseTo(4.25, 2);
    expect(s.distribution).toEqual([
      { value: 3, count: 1 },
      { value: 4, count: 1 },
      { value: 5, count: 2 },
    ]);
  });
  it('sin valores: n=0 y media null', () => {
    expect(summarizeScale([])).toEqual({ n: 0, average: null, distribution: [] });
  });
});
