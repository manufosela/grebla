import { describe, it, expect } from 'vitest';
import { levelAtDate, assessmentProgressionSeries } from './progression.js';

/** Framework mínimo: track engineering con L1→L2→L3 (mismos tiers que el juego). */
const LEVELS = [
  { id: 'eng-l1', code: 'L1', trackId: 'eng', order: 1 },
  { id: 'eng-l2', code: 'L2', trackId: 'eng', order: 2 },
  { id: 'eng-l3', code: 'L3', trackId: 'eng', order: 3 },
];
const FRAMEWORK = { levels: LEVELS };

describe('levelAtDate — nivel vigente en una fecha', () => {
  const history = [
    { from: null, to: 'eng-l1', at: '2025-01-01', byUid: null, note: null },
    { from: 'eng-l1', to: 'eng-l2', at: '2026-06-01', byUid: null, note: null },
  ];

  it('devuelve la última entrada con at <= fecha', () => {
    expect(levelAtDate(history, 'eng-l2', '2025-12-31')).toBe('eng-l1');
    expect(levelAtDate(history, 'eng-l2', '2026-06-01')).toBe('eng-l2');
  });

  it('antes de la primera entrada → su from; sin historial → fallback', () => {
    expect(levelAtDate(history, 'eng-l2', '2024-01-01')).toBe(null);
    expect(levelAtDate([], 'eng-l2', '2026-01-01')).toBe('eng-l2');
    expect(levelAtDate(null, 'eng-l1', '2026-01-01')).toBe('eng-l1');
  });
});

/**
 * La curva que de verdad cuenta la progresión (RMR-TSK-0556): sale de las
 * valoraciones cerradas, no de los certificados del mapa.
 */
describe('assessmentProgressionSeries', () => {
  const person = {
    levelId: 'eng-l2',
    levelHistory: [{ from: 'eng-l1', to: 'eng-l2', at: '2026-05-01', note: 'sube a L2' }],
  };

  it('cada cierre es un punto, ordenado en el tiempo y con el nivel de ESE día', () => {
    const out = assessmentProgressionSeries({
      person,
      framework: FRAMEWORK,
      assessments: [{
        levelId: 'eng-l2',
        closures: [
          { at: '2026-06-01', earned: 9, total: 10, pct: 90 },
          { at: '2026-03-01', earned: 3, total: 10, pct: 30 },
        ],
      }],
    });
    expect(out.points.map((p) => [p.at, p.pct, p.levelCode])).toEqual([
      ['2026-03-01', 30, 'L1'],
      ['2026-06-01', 90, 'L2'],
    ]);
  });

  it('el sub-nivel de cada punto se juzga con el cierre ANTERIOR: el .3 hay que sostenerlo', () => {
    const out = assessmentProgressionSeries({
      person,
      framework: FRAMEWORK,
      assessments: [{
        levelId: 'eng-l2',
        closures: [
          { at: '2026-06-01', earned: 9, total: 10, pct: 90 },
          { at: '2026-07-01', earned: 9, total: 10, pct: 90 },
        ],
      }],
    });
    expect(out.points.map((p) => p.sub)).toEqual([2, 3]);
  });

  it('los hitos siguen saliendo del historial de nivel', () => {
    const out = assessmentProgressionSeries({ person, framework: FRAMEWORK, assessments: [] });
    expect(out.milestones).toEqual([{ at: '2026-05-01', fromCode: 'L1', toCode: 'L2', note: 'sube a L2' }]);
  });

  it('sin valoraciones cerradas no hay curva: no se inventa una con certificados', () => {
    const out = assessmentProgressionSeries({
      person,
      framework: FRAMEWORK,
      assessments: [{ levelId: 'eng-l2', closures: [] }, { levelId: 'eng-l3' }],
    });
    expect(out.points).toEqual([]);
  });

  it('un cierre sin fecha o sin porcentaje no pinta nada', () => {
    const out = assessmentProgressionSeries({
      person,
      framework: FRAMEWORK,
      assessments: [{ levelId: 'eng-l2', closures: [{ pct: 50 }, { at: '2026-06-01' }] }],
    });
    expect(out.points).toEqual([]);
  });
});
