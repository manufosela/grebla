import { describe, it, expect } from 'vitest';
import { ISLAND, seedCareerMap, emptyCareerMap, normalizeCareerMap, serializeCareerMap } from './maps.js';

describe('career — persistencia del mapa (helpers puros)', () => {
  it('seedCareerMap devuelve una copia profunda de la isla (fallback)', () => {
    const seed = seedCareerMap();
    expect(seed).toEqual(ISLAND);
    expect(seed).not.toBe(ISLAND);
    seed.cities[0].name = 'cambiado';
    expect(ISLAND.cities[0].name).not.toBe('cambiado');
  });

  it('normalizeCareerMap(null) usa la semilla (documento inexistente)', () => {
    expect(normalizeCareerMap(null)).toEqual(ISLAND);
    expect(normalizeCareerMap(undefined)).toEqual(ISLAND);
  });

  it('normalizeCareerMap(null, otraIsla) cae al placeholder vacío, no a la semilla (MC-14)', () => {
    const map = normalizeCareerMap(null, 'frontend');
    expect(map).toEqual(emptyCareerMap('frontend'));
    expect(map.cities).toEqual([]);
    expect(map.areas).toEqual([]);
    expect(map.startPort).toEqual(ISLAND.startPort);
  });

  it('normalizeCareerMap respeta el islandId y su nombre cae al id (MC-14)', () => {
    const map = normalizeCareerMap({ areas: [], cities: [] }, 'devops');
    expect(map.id).toBe('devops');
    expect(map.name).toBe('devops'); // sin name en data → el id, no «Isla GREBLA»
    const named = normalizeCareerMap({ name: 'Isla DevOps', areas: [], cities: [] }, 'devops');
    expect(named.name).toBe('Isla DevOps');
  });

  it('emptyCareerMap exige id y usa el nombre del índice cuando llega', () => {
    expect(() => emptyCareerMap('')).toThrow();
    expect(emptyCareerMap('fde', 'Isla FDE')).toEqual({
      id: 'fde',
      name: 'Isla FDE',
      areas: [],
      cities: [],
      startPort: ISLAND.startPort,
    });
  });

  it('normalizeCareerMap reconstruye id/name y saneadores de tipos', () => {
    const map = normalizeCareerMap({
      areas: [{ id: 'fe', name: 'Front' }, { id: '', name: 'descartada' }],
      cities: [
        { id: 'a', name: 'A', kind: 'tech', area: 'fe', x: '10', y: 20, weight: '3', prereqs: ['x', 0] },
        { id: '', name: 'sin id' },
      ],
      startPort: { x: 5, y: 9 },
    });
    expect(map.id).toBe('island');
    expect(map.name).toBe(ISLAND.name); // sin name en data → nombre de la isla
    expect(map.areas).toEqual([{ id: 'fe', name: 'Front' }]); // descarta area sin id
    expect(map.cities).toHaveLength(1); // descarta ciudad sin id
    expect(map.cities[0]).toMatchObject({ x: 10, y: 20, weight: 3, prereqs: ['x', '0'] });
    expect(map.startPort).toEqual({ x: 5, y: 9 });
  });

  it('normalizeCareerMap normaliza kind inválido a tech y deprecated/recommendations', () => {
    const map = normalizeCareerMap({
      areas: [{ id: 'fe', name: 'Front' }],
      cities: [
        {
          id: 'a', name: 'A', kind: 'invalido', area: 'fe', x: 1, y: 2, weight: 1,
          prereqs: [], deprecated: true,
          recommendations: [{ kind: 'curso', label: 'C1', url: 'http://x' }, { kind: 'doc', label: '' }],
        },
      ],
    });
    expect(map.cities[0].kind).toBe('tech');
    expect(map.cities[0].deprecated).toBe(true);
    expect(map.cities[0].recommendations).toEqual([{ kind: 'curso', label: 'C1', url: 'http://x' }]);
  });

  it('serializeCareerMap elimina undefined y recomendaciones/urls vacías (Firestore-safe)', () => {
    const serialized = serializeCareerMap({
      id: 'island',
      name: 'Mi isla',
      areas: [{ id: 'fe', name: 'Front' }, { id: '', name: 'x' }],
      cities: [
        {
          id: 'a', name: 'A', kind: 'skill', area: 'fe', x: 12, y: 34, weight: 2, prereqs: ['b', ''],
          recommendations: [{ kind: 'doc', label: 'Doc', url: '' }, { kind: 'curso', label: '' }],
        },
      ],
      startPort: { x: 4, y: 50 },
    });
    expect(serialized.name).toBe('Mi isla');
    expect(serialized.areas).toEqual([{ id: 'fe', name: 'Front' }]);
    const city = serialized.cities[0];
    expect(city.prereqs).toEqual(['b']);
    expect('deprecated' in city).toBe(false); // no deprecated → no se persiste
    // url vacía se descarta; recomendación sin label se descarta
    expect(city.recommendations).toEqual([{ kind: 'doc', label: 'Doc' }]);
    // ningún valor undefined en el objeto serializado
    expect(JSON.stringify(serialized)).not.toContain('null');
  });

  it('normalize→serialize→normalize es estable para la isla semilla', () => {
    const once = serializeCareerMap(seedCareerMap());
    const back = normalizeCareerMap(once);
    const twice = serializeCareerMap(back);
    expect(twice).toEqual(once);
  });
});
