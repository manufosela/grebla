import { describe, it, expect } from 'vitest';
import { topicState, groupTopicsByArea, resolveRoute } from './listView.js';
import { addEndorsement } from './endorsements.js';

/** Isla mock: 2 comarcas, con prerequisito b←a y una casa en desuso. */
const island = {
  id: 'island',
  name: 'Isla Base',
  areas: [
    { id: 'norte', name: 'Norte' },
    { id: 'sur', name: 'Sur' },
  ],
  cities: [
    { id: 'a', name: 'A', kind: 'skill', area: 'norte', x: 0, y: 0, weight: 1, prereqs: [] },
    { id: 'b', name: 'B', kind: 'skill', area: 'norte', x: 0, y: 0, weight: 1, prereqs: ['a'] },
    { id: 'c', name: 'C', kind: 'tech', area: 'sur', x: 0, y: 0, weight: 1, prereqs: [], deprecated: true },
  ],
};

describe('topicState', () => {
  it('done cuando la casa está visitada', () => {
    const s = topicState(island.cities[0], { map: island, journey: { visitedCities: ['a'] } });
    expect(s.done).toBe(true);
    expect(s.available).toBe(false);
    expect(s.blocked).toBe(false);
  });

  it('available cuando es alcanzable y no visitada; blocked cuando faltan prereqs', () => {
    const a = topicState(island.cities[0], { map: island, journey: { visitedCities: [] } });
    expect(a.available).toBe(true);
    const b = topicState(island.cities[1], { map: island, journey: { visitedCities: [] } });
    expect(b.blocked).toBe(true); // b necesita 'a'
    const bOk = topicState(island.cities[1], { map: island, journey: { visitedCities: ['a'] } });
    expect(bOk.available).toBe(true);
  });

  it('deprecated para casas en desuso', () => {
    const s = topicState(island.cities[2], { map: island, journey: { visitedCities: [] } });
    expect(s.deprecated).toBe(true);
  });

  it('current, inRoute y endorsed', () => {
    const endorsements = addEndorsement({ byCity: {} }, 'a', { uid: 'u1', name: 'Jefa' }, '2026-07-01T00:00:00Z');
    const s = topicState(island.cities[0], {
      map: island,
      journey: { visitedCities: ['a'], currentCity: 'a', plannedRoute: ['a', 'b'] },
      endorsements,
    });
    expect(s.current).toBe(true);
    expect(s.inRoute).toBe(true);
    expect(s.endorsed).toBe(true);
  });

  it('sin avales → endorsed false', () => {
    const s = topicState(island.cities[0], { map: island, journey: {} });
    expect(s.endorsed).toBe(false);
  });
});

describe('groupTopicsByArea', () => {
  it('agrupa por comarca en el orden de areas y omite comarcas vacías', () => {
    const groups = groupTopicsByArea(island);
    expect(groups.map((g) => g.area.id)).toEqual(['norte', 'sur']);
    expect(groups[0].cities.map((c) => c.id)).toEqual(['a', 'b']);
    expect(groups[1].cities.map((c) => c.id)).toEqual(['c']);
  });

  it('las ciudades sin comarca conocida caen en «Otros»', () => {
    const map = { areas: [{ id: 'norte', name: 'Norte' }], cities: [{ id: 'x', name: 'X', area: 'zzz' }] };
    const groups = groupTopicsByArea(map);
    expect(groups.at(-1)).toMatchObject({ area: { id: '_other' } });
    expect(groups.at(-1).cities.map((c) => c.id)).toEqual(['x']);
  });
});

describe('resolveRoute', () => {
  const other = { id: 'isla2', name: 'Isla 2', areas: [], cities: [{ id: 'z', name: 'Z', area: 'x' }] };

  it('resuelve ids en orden y multi-isla, ignorando desconocidos', () => {
    const maps = new Map([['island', island], ['isla2', other]]);
    const route = resolveRoute(['b', 'z', 'noexiste', 'a'], maps);
    expect(route.map((r) => r.city.id)).toEqual(['b', 'z', 'a']);
    expect(route[1].map.id).toBe('isla2');
  });

  it('acepta un iterable de mapas y ruta vacía', () => {
    expect(resolveRoute([], [island])).toEqual([]);
    expect(resolveRoute(['a'], [island])[0].city.id).toBe('a');
  });
});
