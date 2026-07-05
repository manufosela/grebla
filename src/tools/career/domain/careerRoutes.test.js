import { describe, it, expect } from 'vitest';
import {
  ROUTE_TIER_KEYS,
  routeDocId,
  tierKeyForLevelOrder,
  suggestedTierKey,
  normalizeCareerRoute,
  groupRoutesByRole,
  islandOfStop,
  playerRouteDiscipline,
} from './careerRoutes.js';

/** Escala mínima de prueba (misma forma que LEVELS de la tool Equipo). */
const SCALE = [
  { key: 'tiro', order: 1 },
  { key: 'novicius', order: 2 },
  { key: 'peritus', order: 3 },
  { key: 'expertus', order: 4 },
  { key: 'veteranus', order: 5 },
  { key: 'primus', order: 6 },
  { key: 'magister', order: 7 },
];

/** Índice de islas de prueba (Bases con doc id 'island' y disciplina 'bases'). */
const ISLANDS = [
  { id: 'island', name: 'Bases de software', discipline: 'bases' },
  { id: 'backend-php', name: 'Isla Backend PHP', discipline: 'backend-php' },
  { id: 'postgres', name: 'Isla Postgres', discipline: 'postgres' },
];

/** Doc de ruta válido de prueba. @param {Record<string, unknown>} [patch] */
const routeDoc = (patch = {}) => ({
  discipline: 'backend-php',
  levelKey: 'veteranus',
  name: 'Backend PHP · Veteranus',
  description: 'Decide y anticipa.',
  stops: ['bases/git', 'backend-php/php-8'],
  active: true,
  ...patch,
});

describe('routeDocId', () => {
  it('compone {disciplina}--{hito}', () => {
    expect(routeDocId('backend-php', 'veteranus')).toBe('backend-php--veteranus');
  });

  it('falla en alto con partes vacías o con barras (prohibidas en ids de doc)', () => {
    expect(() => routeDocId('', 'peritus')).toThrow(/inválido/);
    expect(() => routeDocId('backend-php', '')).toThrow(/inválido/);
    expect(() => routeDocId('bases/git', 'peritus')).toThrow(/inválido/);
  });
});

describe('tierKeyForLevelOrder', () => {
  it('mapea la escala a los tres hitos: 1-3 peritus, 4-5 veteranus, 6-7 magister', () => {
    expect([1, 2, 3].map(tierKeyForLevelOrder)).toEqual(['peritus', 'peritus', 'peritus']);
    expect([4, 5].map(tierKeyForLevelOrder)).toEqual(['veteranus', 'veteranus']);
    expect([6, 7].map(tierKeyForLevelOrder)).toEqual(['magister', 'magister']);
  });

  it('fuera de escala no sugiere nada', () => {
    expect(tierKeyForLevelOrder(0)).toBeNull();
    expect(tierKeyForLevelOrder(8)).toBeNull();
    expect(tierKeyForLevelOrder(2.5)).toBeNull();
    expect(tierKeyForLevelOrder(Number.NaN)).toBeNull();
  });
});

describe('suggestedTierKey', () => {
  it('resuelve el objetivo por key de la escala', () => {
    expect(suggestedTierKey('expertus', SCALE)).toBe('veteranus');
    expect(suggestedTierKey('novicius', SCALE)).toBe('peritus');
    expect(suggestedTierKey('magister', SCALE)).toBe('magister');
  });

  it('resuelve el objetivo por order numérico (string o número)', () => {
    expect(suggestedTierKey('6', SCALE)).toBe('magister');
    expect(suggestedTierKey(4, SCALE)).toBe('veteranus');
  });

  it('sin objetivo o con un id ajeno a la escala no sugiere nada', () => {
    expect(suggestedTierKey(null, SCALE)).toBeNull();
    expect(suggestedTierKey(undefined, SCALE)).toBeNull();
    expect(suggestedTierKey('  ', SCALE)).toBeNull();
    expect(suggestedTierKey('l3', SCALE)).toBeNull();
    expect(suggestedTierKey('9', SCALE)).toBeNull();
  });
});

describe('normalizeCareerRoute', () => {
  it('devuelve null sin dato, con basura o sin lo obligatorio', () => {
    expect(normalizeCareerRoute(null, 'x')).toBeNull();
    expect(normalizeCareerRoute([], 'x')).toBeNull();
    expect(normalizeCareerRoute(routeDoc(), '')).toBeNull();
    expect(normalizeCareerRoute(routeDoc({ discipline: ' ' }), 'x')).toBeNull();
    expect(normalizeCareerRoute(routeDoc({ levelKey: 'expertus' }), 'x')).toBeNull();
    expect(normalizeCareerRoute(routeDoc({ stops: [] }), 'x')).toBeNull();
  });

  it('sanea paradas (trim, sin vacíos ni duplicados) y textos', () => {
    const route = normalizeCareerRoute(
      routeDoc({ stops: [' bases/git ', '', 'bases/git', 42, 'backend-php/php-8'], name: '  ' }),
      'backend-php--veteranus',
    );
    expect(route).toEqual({
      routeId: 'backend-php--veteranus',
      discipline: 'backend-php',
      levelKey: 'veteranus',
      name: 'backend-php--veteranus', // sin rótulo cae al id, no a inventos
      description: 'Decide y anticipa.',
      stops: ['bases/git', 'backend-php/php-8'],
      active: true,
    });
  });

  it('active solo es false si el doc lo dice explícitamente', () => {
    expect(normalizeCareerRoute(routeDoc({ active: undefined }), 'x')?.active).toBe(true);
    expect(normalizeCareerRoute(routeDoc({ active: false }), 'x')?.active).toBe(false);
  });
});

describe('groupRoutesByRole', () => {
  const php = (levelKey) =>
    normalizeCareerRoute(routeDoc({ levelKey, name: `Backend PHP · ${levelKey}` }), `backend-php--${levelKey}`);
  const front = normalizeCareerRoute(
    routeDoc({ discipline: 'frontend', name: 'Frontend · Peritus', levelKey: 'peritus' }),
    'frontend--peritus',
  );

  it('agrupa por disciplina con el rol delante del « · » y ordena por rol', () => {
    const groups = groupRoutesByRole([php('veteranus'), front, php('peritus')]);
    expect(groups.map((g) => g.roleName)).toEqual(['Backend PHP', 'Frontend']);
    expect(ROUTE_TIER_KEYS.filter((k) => groups[0].tiers[k])).toEqual(['peritus', 'veteranus']);
    expect(groups[1].tiers.peritus?.routeId).toBe('frontend--peritus');
  });

  it('las rutas retiradas (active: false) no entran en el catálogo', () => {
    const retired = { ...php('magister'), active: false };
    const groups = groupRoutesByRole([php('peritus'), retired]);
    expect(groups[0].tiers.magister).toBeUndefined();
  });
});

describe('islandOfStop', () => {
  it('resuelve la parada a su isla por la disciplina del prefijo', () => {
    expect(islandOfStop('backend-php/php-8', ISLANDS)).toBe('backend-php');
    expect(islandOfStop('bases/git', ISLANDS)).toBe('island'); // doc id ≠ disciplina
  });

  it('parada sin prefijo conocido → null', () => {
    expect(islandOfStop('marte/agua', ISLANDS)).toBeNull();
    expect(islandOfStop('', ISLANDS)).toBeNull();
    expect(islandOfStop(null, ISLANDS)).toBeNull();
  });
});

describe('playerRouteDiscipline', () => {
  const withRoutes = new Set(['backend-php', 'postgres']);
  /** @param {Record<string, unknown>} [patch] */
  const journey = (patch = {}) => ({
    visitedCities: [],
    currentCity: null,
    plannedRoute: [],
    currentIsland: 'island',
    visitedIslands: ['island'],
    evidences: {},
    challenge: null,
    ...patch,
  });

  it('el reto activo manda (la disciplina va delante del -- de su routeId)', () => {
    const j = journey({
      challenge: { routeId: 'postgres--peritus', name: 'x', stops: ['postgres/sql-fundamentos'], startedAt: null },
      currentIsland: 'backend-php',
    });
    expect(playerRouteDiscipline(j, ISLANDS, withRoutes)).toBe('postgres');
  });

  it('sin reto, la isla actual (si su disciplina tiene ruta)', () => {
    expect(playerRouteDiscipline(journey({ currentIsland: 'backend-php' }), ISLANDS, withRoutes)).toBe('backend-php');
  });

  it('en una isla sin ruta (Bases), la disciplina con más certificados', () => {
    const j = journey({
      visitedCities: ['bases/git', 'bases/terminal', 'postgres/sql-fundamentos', 'backend-php/php-8', 'backend-php/composer'],
    });
    expect(playerRouteDiscipline(j, ISLANDS, withRoutes)).toBe('backend-php');
  });

  it('sin ninguna señal → null (no se destaca nada)', () => {
    expect(playerRouteDiscipline(journey(), ISLANDS, withRoutes)).toBeNull();
  });
});
