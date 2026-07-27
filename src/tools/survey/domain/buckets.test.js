import { describe, it, expect } from 'vitest';
import { tenureYears, tenureBucket } from './buckets.js';

const REF = '2026-07-27T00:00:00Z';

describe('tenureYears', () => {
  it('calcula los años transcurridos', () => {
    expect(tenureYears('2024-07-27T00:00:00Z', REF)).toBeCloseTo(2, 1);
  });
  it('una fecha futura da 0, no negativo', () => {
    expect(tenureYears('2030-01-01T00:00:00Z', REF)).toBe(0);
  });
  it('sin fecha o basura devuelve null', () => {
    expect(tenureYears(null, REF)).toBeNull();
    expect(tenureYears('no-es-fecha', REF)).toBeNull();
  });
});

describe('tenureBucket', () => {
  it('reparte en los tramos correctos', () => {
    expect(tenureBucket('2026-03-01T00:00:00Z', REF)).toBe('<1');
    expect(tenureBucket('2024-01-01T00:00:00Z', REF)).toBe('1-3');
    expect(tenureBucket('2022-01-01T00:00:00Z', REF)).toBe('3-5');
    expect(tenureBucket('2019-01-01T00:00:00Z', REF)).toBe('5-10');
    expect(tenureBucket('2010-01-01T00:00:00Z', REF)).toBe('10+');
  });
  it('sin fecha devuelve null', () => {
    expect(tenureBucket(undefined, REF)).toBeNull();
  });
});
