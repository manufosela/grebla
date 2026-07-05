import { describe, it, expect } from 'vitest';
import { BLOB_DEFAULTS, mulberry32, islandBlobPoints, islandBlobPath } from './islandShape.js';
import { ISLAND_CONTENT } from '../data/islands/index.js';

/** Las 13 ids REALES del archipiélago (bases + 12 disciplinas del ADR). */
const REAL_IDS = Object.keys(ISLAND_CONTENT);

describe('mulberry32 (PRNG determinista)', () => {
  it('mismo seed → misma secuencia, siempre en [0, 1)', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 50; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seeds distintos → secuencias distintas', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('islandBlobPoints (vértices de costa)', () => {
  it('genera entre 12 y 16 puntos según el id', () => {
    for (const id of REAL_IDS) {
      const pts = islandBlobPoints(id);
      expect(pts.length).toBeGreaterThanOrEqual(BLOB_DEFAULTS.minPoints);
      expect(pts.length).toBeLessThanOrEqual(BLOB_DEFAULTS.maxPoints);
    }
  });

  it('mantiene cada vértice entre el 55% y el 100% del radio nominal', () => {
    for (const id of REAL_IDS) {
      for (const p of islandBlobPoints(id)) {
        const r = Math.hypot(p.x - BLOB_DEFAULTS.center, p.y - BLOB_DEFAULTS.center);
        expect(r).toBeGreaterThanOrEqual(BLOB_DEFAULTS.radius * BLOB_DEFAULTS.minFactor - 1e-9);
        expect(r).toBeLessThanOrEqual(BLOB_DEFAULTS.radius * BLOB_DEFAULTS.maxFactor + 1e-9);
      }
    }
  });

  it('es asimétrico: los radios NO son todos iguales (no es un círculo)', () => {
    const radii = islandBlobPoints('frontend').map((p) =>
      Math.hypot(p.x - BLOB_DEFAULTS.center, p.y - BLOB_DEFAULTS.center),
    );
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    expect(max - min).toBeGreaterThan(BLOB_DEFAULTS.radius * 0.1);
  });

  it('rechaza radios inválidos e ids vacíos', () => {
    expect(() => islandBlobPoints('frontend', { radius: 0 })).toThrow(/inválido/i);
    expect(() => islandBlobPoints('')).toThrow(/inválido/i);
  });
});

describe('islandBlobPath (path SVG de la mancha)', () => {
  it('es determinista: misma id → mismo path SIEMPRE', () => {
    for (const id of REAL_IDS) {
      expect(islandBlobPath(id)).toBe(islandBlobPath(id));
    }
  });

  it('islas distintas → paths distintos (las 13 ids reales)', () => {
    const paths = new Set(REAL_IDS.map((id) => islandBlobPath(id)));
    expect(paths.size).toBe(REAL_IDS.length);
  });

  it('produce un path cerrado (M … C … Z) con números de máximo 2 decimales', () => {
    for (const id of REAL_IDS) {
      const path = islandBlobPath(id);
      expect(path).toMatch(/^M -?\d+(\.\d{1,2})? -?\d+(\.\d{1,2})?( C( -?\d+(\.\d{1,2})?,?){6})+ Z$/);
    }
  });

  it('las ids con "/" no rompen', () => {
    const path = islandBlobPath('backend-php/laravel');
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
  });

  it('scale aplica una homotecia sobre el centro sin cambiar la forma', () => {
    const base = islandBlobPoints('devops');
    const c = BLOB_DEFAULTS.center;
    // El path escalado usa los MISMOS vértices multiplicados: comparamos el
    // primer anclaje (el M inicial) contra el vértice escalado a mano.
    const [mx, my] = islandBlobPath('devops', { scale: 1.2 }).match(/-?\d+(\.\d+)?/g).map(Number);
    expect(mx).toBeCloseTo(c + (base[0].x - c) * 1.2, 2);
    expect(my).toBeCloseTo(c + (base[0].y - c) * 1.2, 2);
  });

  it('rechaza escalas inválidas', () => {
    expect(() => islandBlobPath('devops', { scale: 0 })).toThrow(/inválida/i);
    expect(() => islandBlobPath('devops', { scale: Number.NaN })).toThrow(/inválida/i);
  });

  it('el bajío escalado (~1.22) sigue cabiendo en el viewBox 0..100', () => {
    for (const id of REAL_IDS) {
      const nums = islandBlobPath(id, { scale: 1.22 }).match(/-?\d+(\.\d+)?/g).map(Number);
      for (const v of nums) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});
