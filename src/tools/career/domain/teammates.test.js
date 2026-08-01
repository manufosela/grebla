import { describe, it, expect } from 'vitest';
import { deriveTeammates } from './teammates.js';
import { DEFAULT_ISLAND_ID } from './types.js';

const map = {
  id: DEFAULT_ISLAND_ID,
  areas: [{ id: 'z', name: 'Z' }],
  cities: [
    { id: 'a', name: 'A', kind: 'skill', area: 'z', x: 1, y: 2, weight: 1, prereqs: [] },
    { id: 'b', name: 'B', kind: 'skill', area: 'z', x: 3, y: 4, weight: 1, prereqs: [] },
  ],
};

describe('career — compañeros del grupo (deriveTeammates, RMR-PCS-0029 · F1)', () => {
  const members = [
    { personId: 'p1', name: 'Ana' },
    { personId: 'p2', name: 'Ben' },
    { personId: 'p3', name: 'Cid' },
    { personId: 'p4', name: 'Dan' },
  ];
  const journeyById = new Map([
    ['p1', { currentCity: 'a', currentIsland: DEFAULT_ISLAND_ID, visitedCities: ['a'] }],
    ['p2', { currentCity: 'b', currentIsland: 'frontend', visitedCities: [] }], // en OTRA isla
    ['p3', { currentCity: null, currentIsland: DEFAULT_ISLAND_ID, visitedCities: [] }], // sin ciudad
    // p4 sin journey cargado
  ]);

  it('solo compañeros del grupo que están en la isla actual y tienen ciudad', () => {
    const out = deriveTeammates({ members, journeyById, currentIsland: DEFAULT_ISLAND_ID, map });
    expect(out.map((t) => t.personId)).toEqual(['p1']);
    expect(out[0]).toMatchObject({ name: 'Ana', currentCity: 'a' });
    expect(typeof out[0].progressPct).toBe('number');
  });

  it('sin miembros (no estás en grupo) → sin compañeros', () => {
    expect(deriveTeammates({ members: [], journeyById, currentIsland: DEFAULT_ISLAND_ID, map })).toEqual([]);
    expect(deriveTeammates({ members: null, journeyById, currentIsland: DEFAULT_ISLAND_ID, map })).toEqual([]);
  });

  it('sin mapa cargado → sin compañeros', () => {
    expect(deriveTeammates({ members, journeyById, currentIsland: DEFAULT_ISLAND_ID, map: null })).toEqual([]);
  });

  it('deduplica miembros repetidos (varios carpools comparten persona)', () => {
    const dup = [{ personId: 'p1', name: 'Ana' }, { personId: 'p1', name: 'Ana' }];
    const out = deriveTeammates({ members: dup, journeyById, currentIsland: DEFAULT_ISLAND_ID, map });
    expect(out).toHaveLength(1);
  });
});
