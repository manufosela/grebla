import { describe, it, expect } from 'vitest';
import { nextLevelFor, subLevelFor, subLevelLabel } from './subLevel.js';

const LEVELS = [
  { id: 'l0', code: 'L0', trackId: 'ic', order: 1 },
  { id: 'l1', code: 'L1', trackId: 'ic', order: 2 },
  { id: 'l2', code: 'L2', trackId: 'ic', order: 3 },
  { id: 'l3tl', code: 'L3-TL', trackId: 'tl', order: 4 },
];

const journey = (visited) => ({ visitedCities: visited });

describe('nextLevelFor', () => {
  it('devuelve el siguiente nivel del MISMO track por order', () => {
    expect(nextLevelFor(LEVELS, 'l0')?.id).toBe('l1');
    expect(nextLevelFor(LEVELS, 'l1')?.id).toBe('l2');
  });

  it('último nivel del track o nivel desconocido → null', () => {
    expect(nextLevelFor(LEVELS, 'l2')).toBeNull();
    expect(nextLevelFor(LEVELS, 'nope')).toBeNull();
    expect(nextLevelFor(LEVELS, 'l3tl')).toBeNull();
  });
});

describe('subLevelFor — progresión derivada dentro del nivel (RMR-PCS-0034)', () => {
  const stops = ['bases/a', 'bases/b', 'backend/c', 'backend/d'];

  it('.1: recién alcanzado (<25% de la ruta del siguiente nivel evidenciado)', () => {
    expect(subLevelFor(stops, journey([]))).toEqual({ sub: 1, done: 0, total: 4, pct: 0 });
  });

  it('.2: consolida (25–70%) — el límite del 25% ya es .2', () => {
    expect(subLevelFor(stops, journey(['bases/a'])).sub).toBe(2); // 25% exacto
    expect(subLevelFor(stops, journey(['bases/a', 'backend/c'])).sub).toBe(2); // 50%
  });

  it('.3: a las puertas (>70%) — el 70% exacto sigue siendo .2', () => {
    expect(subLevelFor(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], journey(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).sub).toBe(2); // 70%
    expect(subLevelFor(stops, journey(['bases/a', 'bases/b', 'backend/c'])).sub).toBe(3); // 75%
    expect(subLevelFor(stops, journey(stops)).sub).toBe(3); // 100%
  });

  it('solo cuentan las paradas de LA ruta (otras ciudades visitadas no suman)', () => {
    const j = journey(['otra/x', 'otra/y', 'bases/a']);
    expect(subLevelFor(stops, j)).toEqual({ sub: 2, done: 1, total: 4, pct: 25 });
  });

  it('sin ruta (vacía o null) → null: no se inventa un sub-nivel', () => {
    expect(subLevelFor([], journey(['a']))).toBeNull();
    expect(subLevelFor(null, journey(['a']))).toBeNull();
  });
});

describe('subLevelLabel', () => {
  it('compone «L1.2» con el code del nivel', () => {
    expect(subLevelLabel('L1', 2)).toBe('L1.2');
    expect(subLevelLabel('L2', 3)).toBe('L2.3');
  });
});
