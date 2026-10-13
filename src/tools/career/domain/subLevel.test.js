import { describe, it, expect } from 'vitest';
import { nextLevelFor, subLevelLabel, effectiveSubLevel } from './subLevel.js';

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

describe('subLevelLabel', () => {
  it('compone «L1-2» con el code del nivel', () => {
    expect(subLevelLabel('L1', 2)).toBe('L1-2');
    expect(subLevelLabel('L2', 3)).toBe('L2-3');
  });
});

describe('effectiveSubLevel — el ajuste del manager manda sobre el derivado', () => {
  const derived = { sub: 2, done: 2, total: 4, pct: 50, label: 'L1-2' };

  it('sin override → el derivado con source auto', () => {
    expect(effectiveSubLevel({ }, derived, 'L1')).toEqual({ ...derived, source: 'auto', note: null });
  });

  it('con override válido → manda el manual con su nota', () => {
    const person = { subLevelOverride: { value: 3, note: 'lidera el equipo de facto', byUid: 'u1', at: '2026-08-04' } };
    const out = effectiveSubLevel(person, derived, 'L1');
    expect(out.sub).toBe(3);
    expect(out.label).toBe('L1-3');
    expect(out.source).toBe('manual');
    expect(out.note).toBe('lidera el equipo de facto');
  });

  it('override sin derivado también aplica (el manager puede fijar aunque no haya ruta)', () => {
    const person = { subLevelOverride: { value: 1, note: null } };
    const out = effectiveSubLevel(person, null, 'L2');
    expect(out).toEqual({ sub: 1, done: null, total: null, pct: null, label: 'L2-1', source: 'manual', note: null });
  });

  it('override inválido se ignora; sin nada → null', () => {
    expect(effectiveSubLevel({ subLevelOverride: { value: 7 } }, null, 'L1')).toBeNull();
    expect(effectiveSubLevel({}, null, 'L1')).toBeNull();
    expect(effectiveSubLevel({ subLevelOverride: { value: 2 } }, null, null)).toBeNull();
  });
});
