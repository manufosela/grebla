import { describe, it, expect } from 'vitest';
import {
  ROUTE_TIER_KEYS,
  routeDocId,
  tierKeyForRelativeOrder,
  tierLevelRangeLabel,
  ROUTE_TIER_LABELS,
  suggestedTierKey,
  normalizeCareerRoute,
  groupRoutesByRole,
  islandOfStop,
  playerRouteDiscipline,
} from './careerRoutes.js';

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

describe('suggestedTierKey', () => {
  // careerTargetLevelId apunta SOLO a los niveles L del career framework; la
  // escala de lecturas subjetivas (Tiro→Magister) no interviene en el juego.
  const FRAMEWORK = [
    { id: 'l1', order: 1 },
    { id: 'l2', order: 2 },
    { id: 'l3', order: 3 },
    { id: 'l4', order: 4 },
    { id: 'l5', order: 5 },
    { id: 'l3tl', order: 3 },
    { id: 'l4em', order: 4 },
    { id: 'l5tl', order: 5 },
  ];

  it('resuelve los niveles L del framework por posición relativa', () => {
    expect(suggestedTierKey('l1', FRAMEWORK)).toBe('peritus');
    expect(suggestedTierKey('l2', FRAMEWORK)).toBe('peritus');
    expect(suggestedTierKey('l3', FRAMEWORK)).toBe('veteranus');
    expect(suggestedTierKey('l4', FRAMEWORK)).toBe('veteranus');
    expect(suggestedTierKey('l5', FRAMEWORK)).toBe('magister');
  });

  it('las variantes de track conservan el orden de su nivel (case-insensitive)', () => {
    expect(suggestedTierKey('l3tl', FRAMEWORK)).toBe('veteranus');
    expect(suggestedTierKey('L4EM', FRAMEWORK)).toBe('veteranus');
    expect(suggestedTierKey('l5tl', FRAMEWORK)).toBe('magister');
  });

  it('sin objetivo, sin marco o con un id ajeno al marco no sugiere nada', () => {
    expect(suggestedTierKey(null, FRAMEWORK)).toBeNull();
    expect(suggestedTierKey(undefined, FRAMEWORK)).toBeNull();
    expect(suggestedTierKey('  ', FRAMEWORK)).toBeNull();
    expect(suggestedTierKey('peritus', FRAMEWORK)).toBeNull();
    expect(suggestedTierKey('l3', [])).toBeNull();
    expect(suggestedTierKey('l3')).toBeNull();
  });

  it('tierLevelRangeLabel invierte el mapeo como tramo legible', () => {
    expect(tierLevelRangeLabel('peritus', FRAMEWORK)).toBe('≈ L1–L2');
    expect(tierLevelRangeLabel('veteranus', FRAMEWORK)).toBe('≈ L3–L4');
    expect(tierLevelRangeLabel('magister', FRAMEWORK)).toBe('≈ L5');
    expect(tierLevelRangeLabel('peritus', [])).toBe('');
    expect(tierLevelRangeLabel('peritus')).toBe('');
  });

  it('los rangos piratas cubren los tres hitos', () => {
    expect(ROUTE_TIER_KEYS.map((k) => ROUTE_TIER_LABELS[k])).toEqual(['Grumete', 'Corsario', 'Capitán']);
  });

  it('tierKeyForRelativeOrder acota entradas inválidas', () => {
    expect(tierKeyForRelativeOrder(0, 5)).toBeNull();
    expect(tierKeyForRelativeOrder(3, 0)).toBeNull();
    expect(tierKeyForRelativeOrder(Number.NaN, 5)).toBeNull();
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
