import { describe, it, expect } from 'vitest';
import {
  SUPER_CITIZEN_MIN,
  LEGEND_MIN,
  islandCertificates,
  islandCitizenship,
  archipelagoProgress,
  citizenshipCelebrations,
} from './citizenship.js';

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
  citiesTotal: 5,
  ...over,
});

describe('islandCertificates (certificados por disciplina, MC-20)', () => {
  it('cuenta solo las visitadas con el prefijo de la disciplina', () => {
    const j = journey({ visitedCities: ['bases/git', 'bases/js', 'frontend/react', 'ios/swift'] });
    expect(islandCertificates(j, 'bases')).toBe(2);
    expect(islandCertificates(j, 'frontend')).toBe(1);
    expect(islandCertificates(j, 'devops')).toBe(0);
  });

  it('el prefijo es exacto: «backend-php» no cuenta para «backend»', () => {
    const j = journey({ visitedCities: ['backend-php/laravel', 'backend-python/django'] });
    expect(islandCertificates(j, 'backend-php')).toBe(1);
    expect(islandCertificates(j, 'backend')).toBe(0);
  });

  it('sin disciplina o sin journey no cuenta nada (sin celebraciones fantasma)', () => {
    expect(islandCertificates(journey({ visitedCities: ['/x', 'a/b'] }), '')).toBe(0);
    expect(islandCertificates(undefined, 'bases')).toBe(0);
  });
});

describe('islandCitizenship (ciudadanía de UNA isla)', () => {
  it('calcula certificados, total, pct truncado, objetivo y logro', () => {
    const j = journey({ visitedCities: ['frontend/html', 'frontend/css', 'frontend/js', 'bases/git'] });
    expect(islandCitizenship(j, ref())).toEqual({
      certificates: 3,
      total: 5,
      pct: 60, // 3/5
      targetPct: 80,
      achieved: false,
    });
  });

  it('achieved en el umbral EXACTO (aritmética entera, sin flotantes)', () => {
    const cities = (n) => Array.from({ length: n }, (_, i) => `frontend/c${i}`);
    // 4/5 = 80% ≥ 80 → ciudadanía; 3/5 = 60% no.
    expect(islandCitizenship(journey({ visitedCities: cities(4) }), ref()).achieved).toBe(true);
    expect(islandCitizenship(journey({ visitedCities: cities(3) }), ref()).achieved).toBe(false);
    // 17/20 = 85% con objetivo 85: justo (el clásico caso flotante 0.85·100).
    const twenty = ref({ citiesTotal: 20, citizenshipPct: 85 });
    expect(islandCitizenship(journey({ visitedCities: cities(17) }), twenty).achieved).toBe(true);
    expect(islandCitizenship(journey({ visitedCities: cities(16) }), twenty).achieved).toBe(false);
  });

  it('el pct truncado nunca supera el real: mostrado ≥ objetivo ⟺ achieved', () => {
    // 16/20 = 80% real; con objetivo 81 no hay ciudadanía y el pct mostrado (80) < 81.
    const island = ref({ citiesTotal: 20, citizenshipPct: 81 });
    const c = islandCitizenship(journey({ visitedCities: Array.from({ length: 16 }, (_, i) => `frontend/c${i}`) }), island);
    expect(c.pct).toBe(80);
    expect(c.achieved).toBe(false);
  });

  it('una isla sin sembrar (citiesTotal 0) nunca regala la ciudadanía', () => {
    const c = islandCitizenship(journey({ visitedCities: ['frontend/react'] }), ref({ citiesTotal: 0 }));
    expect(c).toMatchObject({ certificates: 1, total: 0, pct: 0, achieved: false });
  });

  it('la isla de INICIO cuenta por disciplina «bases», no por su id «island»', () => {
    const start = ref({ id: 'island', name: 'Bases de software', discipline: 'bases', citizenshipPct: 100, citiesTotal: 2 });
    const j = journey({ visitedCities: ['bases/git', 'bases/js'] });
    expect(islandCitizenship(j, start)).toMatchObject({ certificates: 2, pct: 100, achieved: true });
  });
});

describe('archipelagoProgress (agregados del archipiélago)', () => {
  const islands = [
    ref({ id: 'island', name: 'Bases de software', discipline: 'bases', citizenshipPct: 100, citiesTotal: 2, startIsland: true }),
    ref({ id: 'frontend', citiesTotal: 2, citizenshipPct: 80 }),
    ref({ id: 'devops', name: 'Isla DevOps', discipline: 'devops', citiesTotal: 2, citizenshipPct: 75 }),
    ref({ id: 'ios', name: 'Isla iOS', discipline: 'ios', citiesTotal: 2, citizenshipPct: 75 }),
    ref({ id: 'fde', name: 'Isla FDE', discipline: 'fde', citiesTotal: 2, citizenshipPct: 70 }),
    ref({ id: 'postgres', name: 'Isla Postgres', discipline: 'postgres', citiesTotal: 2, citizenshipPct: 85 }),
    ref({ id: 'android', name: 'Isla Android', discipline: 'android', citiesTotal: 2, citizenshipPct: 75 }),
  ];
  /** Las 2 ciudades de una disciplina (ciudadanía asegurada). */
  const both = (d) => [`${d}/a`, `${d}/b`];

  it('devuelve la ciudadanía por isla en el orden del índice más los agregados', () => {
    const j = journey({ visitedCities: [...both('bases'), 'frontend/a'], visitedIslands: ['island', 'frontend'] });
    const p = archipelagoProgress(j, islands);
    expect(p.islands.map((i) => i.id)).toEqual(['island', 'frontend', 'devops', 'ios', 'fde', 'postgres', 'android']);
    expect(p.islands[0]).toMatchObject({ name: 'Bases de software', achieved: true });
    expect(p.islands[1]).toMatchObject({ certificates: 1, pct: 50, achieved: false });
    expect(p).toMatchObject({ citizenships: 1, islandsVisited: 2, superCitizen: false, legend: false });
  });

  it('islandsVisited ignora duplicados e islas fuera del índice', () => {
    const j = journey({ visitedIslands: ['island', 'island', 'frontend', 'atlantis'] });
    expect(archipelagoProgress(j, islands).islandsVisited).toBe(2);
  });

  it('super-ciudadano exige ≥ 3 ciudadanías INCLUYENDO la isla de inicio', () => {
    // 3 ciudadanías SIN Bases: no hay badge.
    const sinBases = journey({ visitedCities: [...both('frontend'), ...both('devops'), ...both('ios')] });
    expect(archipelagoProgress(sinBases, islands).superCitizen).toBe(false);
    // 3 ciudadanías CON Bases: badge.
    const conBases = journey({ visitedCities: [...both('bases'), ...both('devops'), ...both('ios')] });
    const p = archipelagoProgress(conBases, islands);
    expect(p.citizenships).toBe(SUPER_CITIZEN_MIN);
    expect(p.superCitizen).toBe(true);
    expect(p.legend).toBe(false);
  });

  it('leyenda con ≥ 6 ciudadanías', () => {
    const j = journey({
      visitedCities: ['bases', 'frontend', 'devops', 'ios', 'fde', 'postgres'].flatMap(both),
    });
    const p = archipelagoProgress(j, islands);
    expect(p.citizenships).toBe(LEGEND_MIN);
    expect(p.legend).toBe(true);
    expect(p.superCitizen).toBe(true);
  });

  it('journey vacío o sin islas: agregados a cero sin errores', () => {
    expect(archipelagoProgress(journey(), islands)).toMatchObject({ citizenships: 0, islandsVisited: 1 });
    expect(archipelagoProgress(journey(), [])).toEqual({
      islands: [], citizenships: 0, islandsVisited: 0, superCitizen: false, legend: false,
    });
  });
});

describe('citizenshipCelebrations (diff de progresión, MC-20)', () => {
  const islands = [
    ref({ id: 'island', name: 'Bases de software', discipline: 'bases', citizenshipPct: 100, citiesTotal: 2, startIsland: true }),
    ref({ id: 'frontend', citiesTotal: 2, citizenshipPct: 80 }),
    ref({ id: 'devops', name: 'Isla DevOps', discipline: 'devops', citiesTotal: 2, citizenshipPct: 75 }),
    ref({ id: 'ios', name: 'Isla iOS', discipline: 'ios', citiesTotal: 2, citizenshipPct: 75 }),
    ref({ id: 'fde', name: 'Isla FDE', discipline: 'fde', citiesTotal: 2, citizenshipPct: 70 }),
    ref({ id: 'postgres', name: 'Isla Postgres', discipline: 'postgres', citiesTotal: 2, citizenshipPct: 85 }),
  ];

  it('cruzar el umbral de la isla anuncia su ciudadanía (antes < objetivo, ahora ≥)', () => {
    const prev = journey({ visitedCities: ['frontend/a'] });
    const next = journey({ visitedCities: ['frontend/a', 'frontend/b'] });
    expect(citizenshipCelebrations(prev, next, islands)).toEqual([
      { kind: 'island', islandId: 'frontend', islandName: 'Isla Frontend' },
    ]);
  });

  it('sin cruce de umbral no hay eventos (certificado normal)', () => {
    const prev = journey({ visitedCities: [] });
    const next = journey({ visitedCities: ['frontend/a'] });
    expect(citizenshipCelebrations(prev, next, islands)).toEqual([]);
  });

  it('retirar un certificado o cargar otro journey no anuncia nada', () => {
    const conCiudadania = journey({ visitedCities: ['frontend/a', 'frontend/b'] });
    // Retirada: baja del umbral, sin eventos.
    expect(citizenshipCelebrations(conCiudadania, journey({ visitedCities: ['frontend/a'] }), islands)).toEqual([]);
    // Journey de OTRA persona (conjunto distinto, no «anterior + una»): nada.
    expect(
      citizenshipCelebrations(journey({ visitedCities: ['bases/git'] }), conCiudadania, islands),
    ).toEqual([]);
  });

  it('la ciudadanía que completa el badge encadena los anuncios EN ORDEN', () => {
    const base = ['bases/a', 'bases/b', 'devops/a', 'devops/b', 'ios/a'];
    const prev = journey({ visitedCities: base });
    const next = journey({ visitedCities: [...base, 'ios/b'] });
    expect(citizenshipCelebrations(prev, next, islands)).toEqual([
      { kind: 'island', islandId: 'ios', islandName: 'Isla iOS' },
      { kind: 'super' },
    ]);
    // Y la sexta encadena isla → leyenda (super ya estaba anunciado).
    const cinco = ['bases', 'frontend', 'devops', 'ios', 'fde'].flatMap((d) => [`${d}/a`, `${d}/b`]);
    const prev6 = journey({ visitedCities: [...cinco, 'postgres/a'] });
    const next6 = journey({ visitedCities: [...cinco, 'postgres/a', 'postgres/b'] });
    expect(citizenshipCelebrations(prev6, next6, islands)).toEqual([
      { kind: 'island', islandId: 'postgres', islandName: 'Isla Postgres' },
      { kind: 'legend' },
    ]);
  });
});
