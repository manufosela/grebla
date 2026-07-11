import { describe, it, expect } from 'vitest';
import { sanitizeInterpretation } from './metricsInterpretation.js';

describe('sanitizeInterpretation', () => {
  it('normaliza texto y listas, descartando vacíos', () => {
    const r = sanitizeInterpretation({
      verdict: 'mal',
      summary: '  Hay   atascos   claros ',
      causes: ['WIP alto', '', '  '],
      recommendations: ['Baja el WIP', 'Limita el trabajo en curso'],
    });
    expect(r.verdict).toBe('mal');
    expect(r.summary).toBe('Hay atascos claros');
    expect(r.causes).toEqual(['WIP alto']);
    expect(r.recommendations).toEqual(['Baja el WIP', 'Limita el trabajo en curso']);
  });

  it('verdict inválido → regular', () => {
    expect(sanitizeInterpretation({ verdict: 'excelente' }).verdict).toBe('regular');
  });

  it('tolera basura sin lanzar', () => {
    expect(sanitizeInterpretation(null)).toEqual({ verdict: 'regular', summary: '', causes: [], recommendations: [] });
    expect(sanitizeInterpretation('nope').causes).toEqual([]);
  });
});
