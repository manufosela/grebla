import { describe, it, expect } from 'vitest';
import { mapPoints, totalPoints, progressPct, isReachable, reachableCityIds, levelFor } from './progress.js';

const map = {
  id: 'm',
  name: 'M',
  tag: 't',
  cities: [
    { id: 'a', name: 'A', kind: 'tech', x: 0, y: 0, weight: 1, prereqs: [] },
    { id: 'b', name: 'B', kind: 'tech', x: 0, y: 0, weight: 2, prereqs: ['a'] },
    { id: 'c', name: 'C', kind: 'tech', x: 0, y: 0, weight: 3, prereqs: ['a', 'b'] },
  ],
};

describe('career progress', () => {
  it('puntos y progreso', () => {
    expect(totalPoints(map)).toBe(6);
    expect(mapPoints(map, ['a', 'b'])).toBe(3);
    expect(progressPct(map, ['a', 'b'])).toBe(50);
    expect(progressPct(map, [])).toBe(0);
  });

  it('alcanzabilidad por prerequisitos', () => {
    expect(isReachable(map, 'a', [])).toBe(true); // sin prereqs
    expect(isReachable(map, 'b', [])).toBe(false);
    expect(isReachable(map, 'b', ['a'])).toBe(true);
    expect(isReachable(map, 'c', ['a'])).toBe(false);
    expect(isReachable(map, 'c', ['a', 'b'])).toBe(true);
  });

  it('reachableCityIds = siguientes pasos posibles', () => {
    expect(reachableCityIds(map, [])).toEqual(['a']);
    expect(reachableCityIds(map, ['a'])).toEqual(['b']);
    expect(reachableCityIds(map, ['a', 'b'])).toEqual(['c']);
  });

  it('nivel de viaje por progreso', () => {
    expect(levelFor(0)).toBe('Aprendiz');
    expect(levelFor(50)).toBe('Viajero');
    expect(levelFor(100)).toBe('Leyenda');
  });
});
