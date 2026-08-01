import { describe, it, expect } from 'vitest';
import { careerRoster } from './careerRoster.js';

const islands = [
  { id: 'island', name: 'Bases', discipline: 'bases', x: 50, y: 76, citizenshipPct: 100, citiesTotal: 2 },
  { id: 'frontend', name: 'Frontend', discipline: 'frontend', x: 28, y: 54, citizenshipPct: 80, citiesTotal: 2 },
];
const framework = { levels: [{ id: 'l2', code: 'L2', title: 'Senior Engineer' }] };

describe('career — roster de progreso (careerRoster, RMR-PCS-0029 · F2b)', () => {
  const people = [
    { id: 'p1', name: 'Ana', careerTargetLevelId: 'l2' },
    { id: 'p2', name: 'Ben', careerTargetLevelId: null }, // sin journey ni nivel
  ];
  const journeyById = new Map([
    ['p1', { visitedCities: ['island/a'], currentCity: 'island/a', currentIsland: 'island', visitedIslands: ['island'] }],
  ]);

  it('una fila por persona con nivel, isla actual y agregados numéricos', () => {
    const rows = careerRoster({ people, journeyById, islands, framework });
    expect(rows.map((r) => r.personId)).toEqual(['p1', 'p2']);
    const ana = rows[0];
    expect(ana).toMatchObject({ name: 'Ana', levelCode: 'L2', levelTitle: 'Senior Engineer', started: true, currentIsland: 'Bases' });
    expect(typeof ana.citizenships).toBe('number');
    expect(typeof ana.certificates).toBe('number');
    expect(ana.islandsVisited).toBe(1);
  });

  it('persona sin journey → no empezó, sin nivel, agregados a 0', () => {
    const rows = careerRoster({ people, journeyById, islands, framework });
    const ben = rows[1];
    expect(ben).toMatchObject({ name: 'Ben', levelCode: null, started: false, currentIsland: null, citizenships: 0, certificates: 0, islandsVisited: 0 });
  });

  it('tolera listas vacías', () => {
    expect(careerRoster({ people: [], journeyById: new Map(), islands, framework })).toEqual([]);
    expect(careerRoster({ people: null, journeyById: null, islands: null, framework: null })).toEqual([]);
  });
});
