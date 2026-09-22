import { describe, it, expect } from 'vitest';
import {
  normalizeLevelAssessment, markDimension, marksOf,
  closeAssessment, closureHistory, lastClosure, assertAppendOnlyClosures,
} from './levelAssessment.js';

/**
 * Valoración de una persona contra UN nivel concreto (RMR-PCS-0044 · F2): las
 * marcas son binarias y llevan autor, y cada cierre deja una entrada que no se
 * reescribe — es lo que permite exigir el 80 % «sostenido».
 */
const autor = { uid: 'u-em', name: 'Eva EM' };
const head = { uid: 'u-head', name: 'Hache' };

describe('normalizeLevelAssessment', () => {
  it('sin documento devuelve una valoración vacía de ese nivel', () => {
    expect(normalizeLevelAssessment(null, 'l2')).toEqual({ levelId: 'l2', byDimension: {}, closures: [] });
  });

  it('descarta marcas que no son objetos y cierres sin fecha o sin pesos', () => {
    const raw = {
      levelId: 'l2',
      byDimension: { tech: { meets: true }, roto: 'sí', product: { meets: 'no' } },
      closures: [{ at: '2026-09-01T10:00:00Z', earned: 3, total: 10, pct: 30 }, { earned: 5, total: 10 }, null],
    };
    const a = normalizeLevelAssessment(raw, 'l2');
    expect(Object.keys(a.byDimension)).toEqual(['tech', 'product']);
    expect(a.byDimension.product.meets).toBe(false); // lo que no es true, no cumple
    expect(a.closures).toHaveLength(1);
  });

  it('manda el nivel PEDIDO, y un documento que dice ser de otro nivel se rechaza', () => {
    expect(normalizeLevelAssessment({}, 'l2').levelId).toBe('l2');
    expect(normalizeLevelAssessment({ levelId: 'l2' }, 'l2').levelId).toBe('l2');
    expect(() => normalizeLevelAssessment({ levelId: 'l3' }, 'l2')).toThrow(/dice ser de l3/);
  });
});

describe('markDimension', () => {
  const base = normalizeLevelAssessment(null, 'l2');

  it('guarda la marca con su autor y su fecha, sin tocar el original', () => {
    const a = markDimension(base, 'tech', { meets: true, note: ' cubre el diseño ', by: autor, at: '2026-09-22T08:00:00Z' });
    expect(a.byDimension.tech).toEqual({ meets: true, note: 'cubre el diseño', by: autor, at: '2026-09-22T08:00:00Z' });
    expect(base.byDimension).toEqual({});
  });

  it('el head reescribe la marca del EM y queda quién fue el último', () => {
    const delEm = markDimension(base, 'tech', { meets: true, by: autor, at: '2026-09-22T08:00:00Z' });
    const delHead = markDimension(delEm, 'tech', { meets: false, note: 'aún no', by: head, at: '2026-09-23T08:00:00Z' });
    expect(delHead.byDimension.tech).toMatchObject({ meets: false, note: 'aún no', by: head });
  });

  it('sin dimensión no hay marca que guardar', () => {
    expect(markDimension(base, '', { meets: true })).toBe(base);
  });
});

describe('marksOf', () => {
  it('saca el mapa binario que espera el cálculo de progresión', () => {
    let a = normalizeLevelAssessment(null, 'l2');
    a = markDimension(a, 'tech', { meets: true, by: autor });
    a = markDimension(a, 'product', { meets: false, by: autor });
    expect(marksOf(a)).toEqual({ tech: true, product: false });
  });
});

describe('cierres', () => {
  const base = normalizeLevelAssessment(null, 'l2');
  const completion = { earned: 8, total: 10, pct: 80 };

  it('cerrar añade una entrada con los pesos, el autor y la fecha', () => {
    const a = closeAssessment(base, completion, { by: autor, at: '2026-09-22T08:00:00Z' });
    expect(a.closures).toEqual([{ at: '2026-09-22T08:00:00Z', earned: 8, total: 10, pct: 80, by: autor }]);
  });

  it('los cierres solo se AÑADEN: el anterior no se toca ni se reordena', () => {
    const uno = closeAssessment(base, { earned: 3, total: 10, pct: 30 }, { by: autor, at: '2026-09-01T08:00:00Z' });
    const dos = closeAssessment(uno, completion, { by: head, at: '2026-09-22T08:00:00Z' });
    expect(dos.closures.map((c) => c.pct)).toEqual([30, 80]);
    expect(uno.closures).toHaveLength(1);
  });

  it('sin cumplimiento medible no se cierra nada', () => {
    expect(closeAssessment(base, null, { by: autor })).toBe(base);
  });

  it('assertAppendOnlyClosures deja pasar lo añadido y rechaza recortar o retocar la evidencia', () => {
    const uno = { at: '2026-09-01T08:00:00Z', earned: 3, total: 10, pct: 30, by: autor };
    const dos = { at: '2026-09-22T08:00:00Z', earned: 8, total: 10, pct: 80, by: autor };
    expect(() => assertAppendOnlyClosures([uno], [uno, dos])).not.toThrow();
    expect(() => assertAppendOnlyClosures([], [uno])).not.toThrow();
    expect(() => assertAppendOnlyClosures([uno, dos], [uno])).toThrow(/no se borran/);
    expect(() => assertAppendOnlyClosures([uno], [{ ...uno, earned: 9 }])).toThrow(/no se puede modificar/);
    // Ni el porcentaje ni el autor de un cierre viejo se reescriben.
    expect(() => assertAppendOnlyClosures([uno], [{ ...uno, pct: 99 }])).toThrow(/no se puede modificar/);
    expect(() => assertAppendOnlyClosures([uno], [{ ...uno, by: head }])).toThrow(/no se puede modificar/);
    expect(() => assertAppendOnlyClosures([uno], [dos, uno])).toThrow(/no se puede modificar/);
  });

  it('closureHistory devuelve del más reciente al más antiguo, que es como lo lee la progresión', () => {
    let a = closeAssessment(base, { earned: 3, total: 10, pct: 30 }, { by: autor, at: '2026-09-01T08:00:00Z' });
    a = closeAssessment(a, completion, { by: autor, at: '2026-09-22T08:00:00Z' });
    expect(closureHistory(a).map((c) => c.pct)).toEqual([80, 30]);
    expect(lastClosure(a).pct).toBe(80);
    expect(lastClosure(base)).toBeNull();
  });
});
