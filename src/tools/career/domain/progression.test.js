import { describe, it, expect } from 'vitest';
import { certificateDatesFrom, levelAtDate, progressionSeries } from './progression.js';

/** Framework mínimo: track engineering con L1→L2→L3 (mismos tiers que el juego). */
const LEVELS = [
  { id: 'eng-l1', code: 'L1', trackId: 'eng', order: 1 },
  { id: 'eng-l2', code: 'L2', trackId: 'eng', order: 2 },
  { id: 'eng-l3', code: 'L3', trackId: 'eng', order: 3 },
];
const FRAMEWORK = { levels: LEVELS };

describe('certificateDatesFrom — fechas de certificados desde la bitácora', () => {
  it('mapea cityId → fecha del PRIMER apunte certificate; ignora eventos de ruta', () => {
    const logbook = {
      entries: [
        { kind: 'certificate', ref: 'a/x', label: 'X', at: '2026-01-10' },
        { kind: 'route-start', ref: 'r1', label: 'Reto', at: '2026-01-11' },
        { kind: 'certificate', ref: 'a/y', label: 'Y', at: '2026-02-01' },
        { kind: 'certificate', ref: 'a/x', label: 'X otra vez', at: '2026-03-01' },
      ],
    };
    const dates = certificateDatesFrom(logbook);
    expect(dates.get('a/x')).toBe('2026-01-10');
    expect(dates.get('a/y')).toBe('2026-02-01');
    expect(dates.size).toBe(2);
  });

  it('bitácora vacía o basura → mapa vacío', () => {
    expect(certificateDatesFrom(null).size).toBe(0);
    expect(certificateDatesFrom({ entries: 'nope' }).size).toBe(0);
  });
});

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

describe('progressionSeries — la curva del sub-nivel', () => {
  // Con 3 niveles (order/max): eng-l2 → veteranus (0.66), eng-l3 → magister (1.0).
  // La ruta del siguiente nivel de L1 es veteranus; la del siguiente de L2, magister.
  const ROUTES = [
    { routeId: 'frontend--veteranus', stops: ['a/1', 'a/2', 'a/3', 'a/4'] },
    { routeId: 'frontend--magister', stops: ['b/1', 'b/2', 'b/3', 'b/4'] },
  ];
  const person = { levelId: 'eng-l2', disciplines: ['frontend'] };

  it('un punto por fecha-evento, pct creciente, y el hito de promoción marcado', () => {
    const logbook = {
      entries: [
        { kind: 'certificate', ref: 'a/1', label: '1', at: '2026-01-10' },
        { kind: 'certificate', ref: 'a/2', label: '2', at: '2026-02-10' },
        { kind: 'certificate', ref: 'a/3', label: '3', at: '2026-03-10' },
        { kind: 'certificate', ref: 'b/1', label: 'b1', at: '2026-07-10' },
      ],
    };
    const levelHistory = [
      { from: null, to: 'eng-l1', at: '2025-12-01', byUid: null, note: null },
      { from: 'eng-l1', to: 'eng-l2', at: '2026-06-01', byUid: null, note: 'promoción' },
    ];
    const { points, milestones } = progressionSeries({
      person: { ...person, levelHistory },
      framework: FRAMEWORK,
      routes: ROUTES,
      logbook,
    });
    // Con L1 vigente mide contra frontend--adeptus; tras el hito, contra veteranus.
    const byDate = Object.fromEntries(points.map((p) => [p.at, p]));
    expect(byDate['2025-12-01']).toMatchObject({ levelCode: 'L1', pct: 0, sub: 1 });
    expect(byDate['2026-01-10']).toMatchObject({ levelCode: 'L1', pct: 25, sub: 2 });
    expect(byDate['2026-03-10']).toMatchObject({ levelCode: 'L1', pct: 75, sub: 3 });
    expect(byDate['2026-06-01']).toMatchObject({ levelCode: 'L2', pct: 0, sub: 1 });
    expect(byDate['2026-07-10']).toMatchObject({ levelCode: 'L2', pct: 25, sub: 2 });
    expect(points.map((p) => p.at)).toEqual(['2025-12-01', '2026-01-10', '2026-02-10', '2026-03-10', '2026-06-01', '2026-07-10']);
    expect(milestones).toHaveLength(2);
    expect(milestones[1]).toMatchObject({ at: '2026-06-01', fromCode: 'L1', toCode: 'L2', note: 'promoción' });
  });

  it('sin bitácora fechada y sin historial → serie vacía (no se inventa)', () => {
    const out = progressionSeries({ person, framework: FRAMEWORK, routes: ROUTES, logbook: { entries: [] } });
    expect(out.points).toEqual([]);
    expect(out.milestones).toEqual([]);
  });

  it('fechas-evento sin ruta resoluble (último nivel, sin disciplina) no generan punto', () => {
    const logbook = { entries: [{ kind: 'certificate', ref: 'b/1', label: 'b1', at: '2026-07-10' }] };
    const out = progressionSeries({
      person: { levelId: 'eng-l3', disciplines: ['frontend'] },
      framework: FRAMEWORK,
      routes: ROUTES,
      logbook,
    });
    expect(out.points).toEqual([]);
  });
});
