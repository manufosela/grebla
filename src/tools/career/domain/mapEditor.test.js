import { describe, it, expect } from 'vitest';
import {
  validateCity,
  validateRoute,
  routesAffectedByCity,
  buildCityIndex,
  activeCitiesTotal,
  CITY_WEIGHT_MIN,
  CITY_WEIGHT_MAX,
} from './mapEditor.js';

/** Casa mínima válida para la isla de pruebas. */
const city = (id, extra = {}) => ({
  id,
  name: id,
  kind: 'tech',
  area: 'centro',
  x: 50,
  y: 50,
  weight: 2,
  prereqs: [],
  ...extra,
});

/** Isla de pruebas: una comarca y tres casas encadenadas a → b → c. */
const island = () => ({
  areas: [{ id: 'centro', name: 'Centro' }],
  cities: [
    city('demo/a'),
    city('demo/b', { prereqs: ['demo/a'] }),
    city('demo/c', { prereqs: ['demo/b'] }),
  ],
});

/** Ruta mínima válida sobre la isla de pruebas. */
const route = (extra = {}) => ({
  routeId: 'demo--peritus',
  discipline: 'demo',
  levelKey: 'peritus',
  name: 'Demo · Peritus',
  description: '',
  stops: ['demo/a', 'demo/b'],
  active: true,
  ...extra,
});

describe('validateCity', () => {
  it('acepta una casa nueva bien formada', () => {
    const check = validateCity(city('demo/d', { prereqs: ['demo/c'] }), island());
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
  });

  it('acepta ids sin prefijo (isla semilla legada)', () => {
    expect(validateCity(city('git'), island()).errors).toEqual([]);
  });

  it('rechaza id vacío, con mayúsculas o con separadores raros', () => {
    expect(validateCity(city(''), island()).errors.join(' ')).toContain('necesita un id');
    for (const bad of ['Demo/A', 'demo/a b', 'demo//a', 'demo/a/b', '-demo/a']) {
      expect(validateCity(city(bad), island()).errors.join(' ')).toContain('slug');
    }
  });

  it('rechaza un id que ya existe en la isla', () => {
    const check = validateCity(city('demo/a'), island());
    expect(check.errors.join(' ')).toContain('Ya existe otra casa');
  });

  it('permite conservar el id al editar (el caller excluye la casa editada)', () => {
    const base = island();
    const edited = { ...base.cities[1], name: 'B renombrada' };
    const others = { ...base, cities: base.cities.filter((c) => c.id !== edited.id) };
    expect(validateCity(edited, others).errors).toEqual([]);
  });

  it('exige nombre, tipo conocido y comarca existente', () => {
    const errors = validateCity(
      city('demo/x', { name: ' ', kind: 'castillo', area: 'norte' }),
      island(),
    ).errors.join(' ');
    expect(errors).toContain('necesita un nombre');
    expect(errors).toContain('Tipo de casa desconocido');
    expect(errors).toContain('La comarca "norte" no existe');
  });

  it(`exige peso entero entre ${CITY_WEIGHT_MIN} y ${CITY_WEIGHT_MAX}`, () => {
    for (const weight of [0, 6, 2.5, Number.NaN]) {
      expect(validateCity(city('demo/x', { weight }), island()).errors.join(' ')).toContain('peso');
    }
    expect(validateCity(city('demo/x', { weight: CITY_WEIGHT_MAX }), island()).errors).toEqual([]);
  });

  it('exige posición x/y dentro de 0..100', () => {
    for (const pos of [{ x: -1 }, { y: 101 }, { x: Number.NaN }]) {
      expect(validateCity(city('demo/x', pos), island()).errors.join(' ')).toContain('posición');
    }
  });

  it('rechaza prereqs inexistentes, duplicados o hacia sí misma', () => {
    const errors = validateCity(
      city('demo/x', { prereqs: ['demo/zz', 'demo/a', 'demo/a', 'demo/x'] }),
      island(),
    ).errors.join(' ');
    expect(errors).toContain('"demo/zz" no existe');
    expect(errors).toContain('duplicados');
    expect(errors).toContain('sí misma');
  });

  it('detecta el ciclo que crearía editar una casa existente', () => {
    // a pasa a depender de c (y c ya depende de b, que depende de a): ciclo.
    const base = island();
    const edited = { ...base.cities[0], prereqs: ['demo/c'] };
    const others = { ...base, cities: base.cities.filter((c) => c.id !== edited.id) };
    expect(validateCity(edited, others).errors.join(' ')).toContain('ciclo');
  });
});

describe('validateRoute', () => {
  const content = [{ id: 'demo-isla', name: 'Demo', areas: island().areas, cities: island().cities }];

  it('acepta una ruta bien formada sin avisos', () => {
    expect(validateRoute(route(), content)).toEqual({ errors: [], warnings: [] });
  });

  it('exige disciplina, hito del catálogo, nombre y al menos una parada', () => {
    const errors = validateRoute(
      route({ discipline: ' ', levelKey: 'senior', name: '', stops: [] }),
      content,
    ).errors.join(' ');
    expect(errors).toContain('disciplina');
    expect(errors).toContain('Hito desconocido');
    expect(errors).toContain('nombre');
    expect(errors).toContain('al menos una parada');
  });

  it('rechaza paradas duplicadas o que no existen en ninguna isla', () => {
    const errors = validateRoute(
      route({ stops: ['demo/a', 'demo/a', 'demo/nope'] }),
      content,
    ).errors.join(' ');
    expect(errors).toContain('duplicada');
    expect(errors).toContain('"demo/nope" no existe');
  });

  it('AVISA (sin error) cuando el orden viola un prereq intra-isla', () => {
    const check = validateRoute(route({ stops: ['demo/b', 'demo/a'] }), content);
    expect(check.errors).toEqual([]);
    expect(check.warnings.join(' ')).toContain('"demo/a" es prerequisito de "demo/b"');
  });

  it('no avisa si el prereq no es parada de la ruta', () => {
    expect(validateRoute(route({ stops: ['demo/c'] }), content).warnings).toEqual([]);
  });
});

describe('routesAffectedByCity', () => {
  const catalog = [
    route(),
    route({ routeId: 'demo--veteranus', levelKey: 'veteranus', stops: ['demo/a', 'demo/c'] }),
  ];

  it('devuelve las rutas que paran en la casa', () => {
    expect(routesAffectedByCity('demo/b', catalog).map((r) => r.routeId)).toEqual(['demo--peritus']);
    expect(routesAffectedByCity('demo/a', catalog)).toHaveLength(2);
  });

  it('sin id o sin coincidencias devuelve vacío', () => {
    expect(routesAffectedByCity('', catalog)).toEqual([]);
    expect(routesAffectedByCity('demo/zz', catalog)).toEqual([]);
  });
});

describe('buildCityIndex', () => {
  it('indexa cada casa con el id del DOC de su isla (Bases: doc "island", prefijo "bases/")', () => {
    const index = buildCityIndex([
      { id: 'island', cities: [city('bases/git')] },
      { id: 'demo-isla', cities: island().cities },
    ]);
    expect(index.get('bases/git')?.islandId).toBe('island');
    expect(index.get('demo/b')?.islandId).toBe('demo-isla');
    expect(index.has('demo/zz')).toBe(false);
  });
});

describe('activeCitiesTotal', () => {
  it('cuenta solo las casas no deprecadas (el citiesTotal del índice)', () => {
    const cities = [city('demo/a'), city('demo/b', { deprecated: true }), city('demo/c')];
    expect(activeCitiesTotal(cities)).toBe(2);
    expect(activeCitiesTotal([])).toBe(0);
  });
});
