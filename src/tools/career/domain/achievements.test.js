import { describe, it, expect } from 'vitest';
import { archipelagoProgress } from './citizenship.js';
import {
  EMPTY_ACHIEVEMENTS,
  normalizeAchievements,
  newAchievements,
  mergeAchievements,
  formatAchievedAt,
} from './achievements.js';

/** Journey mínimo de pruebas. @param {Partial<import('./types.js').Journey>} over */
const journey = (over = {}) => ({
  visitedCities: [],
  currentCity: null,
  plannedRoute: [],
  currentIsland: 'island',
  visitedIslands: ['island'],
  evidences: {},
  ...over,
});

/** Ref de isla mínima del índice (normalizada). @param {Partial<import('./types.js').IslandRef>} over */
const ref = (over = {}) => ({
  id: 'frontend',
  name: 'Isla Frontend',
  discipline: 'frontend',
  x: 10,
  y: 10,
  citizenshipPct: 80,
  citiesTotal: 2,
  ...over,
});

const islands = [
  ref({ id: 'island', name: 'Bases de software', discipline: 'bases', citizenshipPct: 100, startIsland: true }),
  ref({ id: 'frontend' }),
  ref({ id: 'devops', name: 'Isla DevOps', discipline: 'devops', citizenshipPct: 75 }),
  ref({ id: 'ios', name: 'Isla iOS', discipline: 'ios', citizenshipPct: 75 }),
  ref({ id: 'fde', name: 'Isla FDE', discipline: 'fde', citizenshipPct: 70 }),
  ref({ id: 'postgres', name: 'Isla Postgres', discipline: 'postgres', citizenshipPct: 85 }),
];

/** Las 2 ciudades de una disciplina (ciudadanía asegurada). @param {string} d */
const both = (d) => [`${d}/a`, `${d}/b`];

/** Progresión de un journey sobre el índice de pruebas. */
const progress = (visitedCities) => archipelagoProgress(journey({ visitedCities }), islands);

const NOW = '2026-07-04T12:00:00.000Z';

describe('normalizeAchievements (saneo del doc, MC-21)', () => {
  it('sin documento devuelve logros vacíos', () => {
    expect(normalizeAchievements(null)).toEqual({ citizenships: {}, badges: {} });
    expect(normalizeAchievements(undefined)).toEqual({ citizenships: {}, badges: {} });
  });

  it('conserva registros válidos y las fechas null de la migración', () => {
    const a = normalizeAchievements({
      citizenships: { frontend: { achievedAt: NOW }, island: { achievedAt: null } },
      badges: { superCitizen: { achievedAt: NOW } },
    });
    expect(a.citizenships.frontend).toEqual({ achievedAt: NOW });
    expect(a.citizenships.island).toEqual({ achievedAt: null });
    expect(a.badges.superCitizen).toEqual({ achievedAt: NOW });
  });

  it('descarta basura: registros no-objeto, fechas no-string, badges desconocidos', () => {
    const a = normalizeAchievements({
      citizenships: { frontend: 'ayer', devops: { achievedAt: 12345 }, '': { achievedAt: NOW } },
      badges: { legend: null, pirata: { achievedAt: NOW } },
    });
    expect(a.citizenships).toEqual({ devops: { achievedAt: null } }); // fecha corrupta → sin fecha
    expect(a.badges).toEqual({});
  });
});

describe('newAchievements (qué falta por registrar)', () => {
  it('sin nada nuevo devuelve null (el caller se ahorra la escritura)', () => {
    expect(newAchievements(progress([]), EMPTY_ACHIEVEMENTS, NOW)).toBeNull();
    // Todo lo logrado ya registrado: tampoco hay parche.
    const done = { citizenships: { frontend: { achievedAt: NOW } }, badges: {} };
    expect(newAchievements(progress(both('frontend')), done, NOW)).toBeNull();
  });

  it('registra la ciudadanía recién lograda con la fecha del gesto', () => {
    expect(newAchievements(progress(both('frontend')), EMPTY_ACHIEVEMENTS, NOW)).toEqual({
      citizenships: { frontend: { achievedAt: NOW } },
      badges: {},
    });
  });

  it('NUNCA re-escribe un registro existente (ni siquiera los null de la migración)', () => {
    const migrated = { citizenships: { frontend: { achievedAt: null } }, badges: {} };
    expect(newAchievements(progress(both('frontend')), migrated, NOW)).toBeNull();
  });

  it('los badges se registran junto a la ciudadanía que los completa', () => {
    const p = progress([...both('bases'), ...both('devops'), ...both('ios')]);
    const prev = {
      citizenships: { island: { achievedAt: NOW }, devops: { achievedAt: NOW } },
      badges: {},
    };
    expect(newAchievements(p, prev, NOW)).toEqual({
      citizenships: { ios: { achievedAt: NOW } },
      badges: { superCitizen: { achievedAt: NOW } },
    });
  });

  it('leyenda con 6 ciudadanías (y super ya registrado no se repite)', () => {
    const p = progress(['bases', 'frontend', 'devops', 'ios', 'fde', 'postgres'].flatMap(both));
    const prev = {
      citizenships: Object.fromEntries(
        ['island', 'frontend', 'devops', 'ios', 'fde'].map((id) => [id, { achievedAt: NOW }]),
      ),
      badges: { superCitizen: { achievedAt: NOW } },
    };
    expect(newAchievements(p, prev, NOW)).toEqual({
      citizenships: { postgres: { achievedAt: NOW } },
      badges: { legend: { achievedAt: NOW } },
    });
  });

  it('migración suave: logros pre-MC-21 se registran con achievedAt null', () => {
    const patch = newAchievements(progress(both('frontend')), EMPTY_ACHIEVEMENTS, null);
    expect(patch).toEqual({ citizenships: { frontend: { achievedAt: null } }, badges: {} });
  });
});

describe('mergeAchievements (fusión de solo-añadir)', () => {
  it('añade lo nuevo sin pisar lo existente y con null devuelve lo mismo', () => {
    const base = { citizenships: { frontend: { achievedAt: null } }, badges: {} };
    const patch = {
      citizenships: { frontend: { achievedAt: NOW }, devops: { achievedAt: NOW } },
      badges: { superCitizen: { achievedAt: NOW } },
    };
    const merged = mergeAchievements(base, patch);
    expect(merged.citizenships.frontend).toEqual({ achievedAt: null }); // no se pisa
    expect(merged.citizenships.devops).toEqual({ achievedAt: NOW });
    expect(merged.badges.superCitizen).toEqual({ achievedAt: NOW });
    expect(mergeAchievements(base, null)).toBe(base);
  });
});

describe('formatAchievedAt (etiqueta de fecha de la ficha)', () => {
  it('formatea un ISO válido como fecha larga en español', () => {
    expect(formatAchievedAt('2026-07-04T12:00:00.000Z')).toBe('4 de julio de 2026');
  });

  it('sin fecha o con fecha inválida devuelve null («fecha no registrada»)', () => {
    expect(formatAchievedAt(null)).toBeNull();
    expect(formatAchievedAt(undefined)).toBeNull();
    expect(formatAchievedAt('')).toBeNull();
    expect(formatAchievedAt('no-es-una-fecha')).toBeNull();
  });
});
