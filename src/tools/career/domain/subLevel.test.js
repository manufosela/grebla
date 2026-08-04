import { describe, it, expect } from 'vitest';
import { nextLevelFor, subLevelFor, subLevelLabel, subLevelForPerson, effectiveSubLevel } from './subLevel.js';

const LEVELS = [
  { id: 'l0', code: 'L0', trackId: 'ic', order: 1 },
  { id: 'l1', code: 'L1', trackId: 'ic', order: 2 },
  { id: 'l2', code: 'L2', trackId: 'ic', order: 3 },
  { id: 'l3tl', code: 'L3-TL', trackId: 'tl', order: 4 },
];

const journey = (visited) => ({ visitedCities: visited });

describe('nextLevelFor', () => {
  it('devuelve el siguiente nivel del MISMO track por order', () => {
    expect(nextLevelFor(LEVELS, 'l0')?.id).toBe('l1');
    expect(nextLevelFor(LEVELS, 'l1')?.id).toBe('l2');
  });

  it('último nivel del track o nivel desconocido → null', () => {
    expect(nextLevelFor(LEVELS, 'l2')).toBeNull();
    expect(nextLevelFor(LEVELS, 'nope')).toBeNull();
    expect(nextLevelFor(LEVELS, 'l3tl')).toBeNull();
  });
});

describe('subLevelFor — progresión derivada dentro del nivel (RMR-PCS-0034)', () => {
  const stops = ['bases/a', 'bases/b', 'backend/c', 'backend/d'];

  it('.1: recién alcanzado (<25% de la ruta del siguiente nivel evidenciado)', () => {
    expect(subLevelFor(stops, journey([]))).toEqual({ sub: 1, done: 0, total: 4, pct: 0 });
  });

  it('.2: consolida (25–70%) — el límite del 25% ya es .2', () => {
    expect(subLevelFor(stops, journey(['bases/a'])).sub).toBe(2); // 25% exacto
    expect(subLevelFor(stops, journey(['bases/a', 'backend/c'])).sub).toBe(2); // 50%
  });

  it('.3: a las puertas (>70%) — el 70% exacto sigue siendo .2', () => {
    expect(subLevelFor(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], journey(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).sub).toBe(2); // 70%
    expect(subLevelFor(stops, journey(['bases/a', 'bases/b', 'backend/c'])).sub).toBe(3); // 75%
    expect(subLevelFor(stops, journey(stops)).sub).toBe(3); // 100%
  });

  it('solo cuentan las paradas de LA ruta (otras ciudades visitadas no suman)', () => {
    const j = journey(['otra/x', 'otra/y', 'bases/a']);
    expect(subLevelFor(stops, j)).toEqual({ sub: 2, done: 1, total: 4, pct: 25 });
  });

  it('sin ruta (vacía o null) → null: no se inventa un sub-nivel', () => {
    expect(subLevelFor([], journey(['a']))).toBeNull();
    expect(subLevelFor(null, journey(['a']))).toBeNull();
  });
});

describe('subLevelForPerson — resolución completa persona→badge', () => {
  const framework = {
    levels: [
      { id: 'l1', code: 'L1', trackId: 'ic', order: 1 },
      { id: 'l2', code: 'L2', trackId: 'ic', order: 2 },
      { id: 'l3', code: 'L3', trackId: 'ic', order: 3 },
      { id: 'l4', code: 'L4', trackId: 'ic', order: 4 },
      { id: 'l5', code: 'L5', trackId: 'ic', order: 5 },
    ],
  };
  // La ruta del SIGUIENTE nivel (l2 → tier del orden relativo de l2).
  const routes = [
    { routeId: 'backend--peritus', discipline: 'backend', stops: ['a', 'b', 'c', 'd'] },
  ];

  it('resuelve nivel→siguiente→tier→ruta y deriva el badge', () => {
    const out = subLevelForPerson({
      person: { levelId: 'l1', disciplines: ['backend'] },
      framework,
      routes,
      journey: { visitedCities: ['a', 'b', 'c'] },
    });
    // Si el tier resuelto no coincide con la ruta publicada, out será null y el
    // test lo hará visible; con la ruta correcta: 75% → .3.
    expect(out).not.toBeNull();
    expect(out.label).toBe('L1.3');
    expect(out.pct).toBe(75);
  });

  it('sin disciplina, sin siguiente nivel o sin ruta publicada → null', () => {
    expect(subLevelForPerson({ person: { levelId: 'l1', disciplines: [] }, framework, routes, journey: {} })).toBeNull();
    expect(subLevelForPerson({ person: { levelId: 'l5', disciplines: ['backend'] }, framework, routes, journey: {} })).toBeNull();
    expect(subLevelForPerson({ person: { levelId: 'l1', disciplines: ['data'] }, framework, routes, journey: {} })).toBeNull();
    expect(subLevelForPerson({ person: { levelId: null, disciplines: ['backend'] }, framework, routes, journey: {} })).toBeNull();
  });
});

describe('subLevelLabel', () => {
  it('compone «L1.2» con el code del nivel', () => {
    expect(subLevelLabel('L1', 2)).toBe('L1.2');
    expect(subLevelLabel('L2', 3)).toBe('L2.3');
  });
});

describe('effectiveSubLevel — el ajuste del manager manda sobre el derivado', () => {
  const derived = { sub: 2, done: 2, total: 4, pct: 50, label: 'L1.2' };

  it('sin override → el derivado con source auto', () => {
    expect(effectiveSubLevel({ }, derived, 'L1')).toEqual({ ...derived, source: 'auto', note: null });
  });

  it('con override válido → manda el manual con su nota', () => {
    const person = { subLevelOverride: { value: 3, note: 'lidera el equipo de facto', byUid: 'u1', at: '2026-08-04' } };
    const out = effectiveSubLevel(person, derived, 'L1');
    expect(out.sub).toBe(3);
    expect(out.label).toBe('L1.3');
    expect(out.source).toBe('manual');
    expect(out.note).toBe('lidera el equipo de facto');
  });

  it('override sin derivado también aplica (el manager puede fijar aunque no haya ruta)', () => {
    const person = { subLevelOverride: { value: 1, note: null } };
    const out = effectiveSubLevel(person, null, 'L2');
    expect(out).toEqual({ sub: 1, done: null, total: null, pct: null, label: 'L2.1', source: 'manual', note: null });
  });

  it('override inválido se ignora; sin nada → null', () => {
    expect(effectiveSubLevel({ subLevelOverride: { value: 7 } }, null, 'L1')).toBeNull();
    expect(effectiveSubLevel({}, null, 'L1')).toBeNull();
    expect(effectiveSubLevel({ subLevelOverride: { value: 2 } }, null, null)).toBeNull();
  });
});
