import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLD, isSegmentVisible, suppressSmall, partitionSegments } from './anonymity.js';

describe('umbral por defecto', () => {
  it('es 5 (decidido por People)', () => {
    expect(DEFAULT_THRESHOLD).toBe(5);
  });
});

describe('isSegmentVisible', () => {
  it('visible con >= N', () => {
    expect(isSegmentVisible(5)).toBe(true);
    expect(isSegmentVisible(4)).toBe(false);
  });
  it('respeta un umbral distinto', () => {
    expect(isSegmentVisible(3, 3)).toBe(true);
  });
  it('cuentas no numéricas no son visibles', () => {
    expect(isSegmentVisible(undefined)).toBe(false);
  });
});

describe('suppressSmall', () => {
  it('quita los segmentos por debajo del umbral', () => {
    const segs = [{ key: 'a', count: 8 }, { key: 'b', count: 2 }, { key: 'c', count: 5 }];
    expect(suppressSmall(segs).map((s) => s.key)).toEqual(['a', 'c']);
  });
});

describe('partitionSegments', () => {
  it('separa visibles de ocultos (para informar cuántos se ocultan)', () => {
    const segs = [{ key: 'a', count: 8 }, { key: 'b', count: 1 }, { key: 'c', count: 3 }];
    const { visible, suppressed } = partitionSegments(segs);
    expect(visible.map((s) => s.key)).toEqual(['a']);
    expect(suppressed.map((s) => s.key)).toEqual(['b', 'c']);
  });
});
