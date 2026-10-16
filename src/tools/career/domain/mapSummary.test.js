import { describe, it, expect } from 'vitest';
import { mapSummary } from './mapSummary.js';

const island = {
  areas: [{ id: 'a1', name: 'Backend' }, { id: 'a2', name: 'Datos' }],
  cities: [
    { id: 'c1', name: 'APIs', area: 'a1', points: 10 },
    { id: 'c2', name: 'Colas', area: 'a1', points: 10 },
    { id: 'c3', name: 'SQL', area: 'a2', points: 10 },
  ],
};

describe('mapSummary: el resumen del mapa que ven la persona y su manager (RMR-TSK-0735)', () => {
  it('sin isla o sin nada trazado, no hay resumen', () => {
    expect(mapSummary(null, { currentCity: 'c1' })).toBeNull();
    expect(mapSummary(island, { visitedCities: [], plannedRoute: [] })).toBeNull();
    expect(mapSummary(island, null)).toBeNull();
  });

  it('casa actual, dominadas por comarca y ruta con nombres', () => {
    const out = mapSummary(island, { currentCity: 'c2', visitedCities: ['c1', 'c3'], plannedRoute: ['c2', 'zz'] });
    expect(out.current.name).toBe('Colas');
    expect(out.dominatedByArea.map((g) => [g.area.name, g.cities.map((c) => c.name)]))
      .toEqual([['Backend', ['APIs']], ['Datos', ['SQL']]]);
    expect(out.visitedCount).toBe(2);
    expect(out.route).toEqual(['Colas', 'zz']);
  });
});
