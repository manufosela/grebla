import { describe, it, expect } from 'vitest';
import { mapPoints, totalPoints, progressPct, isReachable, reachableCityIds, levelFor } from './progress.js';

const map = {
  id: 'm',
  name: 'M',
  areas: [{ id: 'z', name: 'Z' }],
  cities: [
    { id: 'a', name: 'A', kind: 'tech', area: 'z', x: 0, y: 0, weight: 1, prereqs: [] },
    { id: 'b', name: 'B', kind: 'tech', area: 'z', x: 0, y: 0, weight: 2, prereqs: ['a'] },
    { id: 'c', name: 'C', kind: 'tech', area: 'z', x: 0, y: 0, weight: 3, prereqs: ['a', 'b'] },
  ],
};

const mapWithDeprecated = {
  id: 'd',
  name: 'D',
  areas: [{ id: 'z', name: 'Z' }],
  cities: [
    { id: 'a', name: 'A', kind: 'tech', area: 'z', x: 0, y: 0, weight: 1, prereqs: [] },
    { id: 'old', name: 'Old', kind: 'tech', area: 'z', x: 0, y: 0, weight: 2, prereqs: ['a'], deprecated: true },
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

  it('las ciudades deprecadas no son alcanzables ni puntúan', () => {
    expect(isReachable(mapWithDeprecated, 'old', ['a'])).toBe(false);
    expect(reachableCityIds(mapWithDeprecated, ['a'])).toEqual([]);
    expect(totalPoints(mapWithDeprecated)).toBe(1); // 'old' no cuenta
    expect(mapPoints(mapWithDeprecated, ['a', 'old'])).toBe(1); // 'old' no puntúa
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
