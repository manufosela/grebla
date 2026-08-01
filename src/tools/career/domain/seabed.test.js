import { describe, it, expect } from 'vitest';
import { hasSeabed, seabedRef, seabedScene } from './seabed.js';

describe('career — lecho (helpers puros, RMR-PCS-0028 · F3)', () => {
  const islands = [
    { id: 'island', name: 'Bases', x: 50, y: 76, startIsland: true },
    { id: 'frontend', name: 'Frontend', x: 28, y: 54 },
    { id: 'seabed', name: 'El lecho', x: 50, y: 50, seabed: true },
  ];

  it('hasSeabed detecta la isla transversal (y falso si no hay)', () => {
    expect(hasSeabed(islands)).toBe(true);
    expect(hasSeabed(islands.filter((i) => !i.seabed))).toBe(false);
    expect(hasSeabed(null)).toBe(false);
    expect(hasSeabed([])).toBe(false);
  });

  it('seabedRef devuelve el ref del lecho o null', () => {
    expect(seabedRef(islands)?.id).toBe('seabed');
    expect(seabedRef([{ id: 'x', name: 'X', x: 1, y: 2 }])).toBeNull();
    expect(seabedRef(undefined)).toBeNull();
  });

  it('seabedScene mapea arrecifes a nodos y prereqs a aristas from→to', () => {
    const map = {
      id: 'seabed',
      name: 'El lecho',
      areas: [{ id: 'a', name: 'A' }],
      cities: [
        { id: 'orchestration/dar-contexto', name: 'Dar contexto', kind: 'skill', area: 'a', x: 30, y: 62, weight: 3, prereqs: [] },
        { id: 'orchestration/descomponer', name: 'Descomponer', kind: 'skill', area: 'a', x: 22, y: 44, weight: 2, prereqs: ['orchestration/dar-contexto'] },
      ],
    };
    const { nodes, edges } = seabedScene(map);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({ id: 'orchestration/dar-contexto', name: 'Dar contexto', kind: 'skill', x: 30, y: 62, weight: 3, area: 'a' });
    expect(edges).toEqual([{ from: 'orchestration/dar-contexto', to: 'orchestration/descomponer' }]);
  });

  it('seabedScene descarta aristas hacia prereqs inexistentes y tolera vacío', () => {
    const map = {
      cities: [
        { id: 'orchestration/x', name: 'X', kind: 'skill', area: 'a', x: 1, y: 2, weight: 1, prereqs: ['orchestration/fantasma'] },
      ],
    };
    expect(seabedScene(map).edges).toEqual([]);
    expect(seabedScene(null)).toEqual({ nodes: [], edges: [] });
    expect(seabedScene({})).toEqual({ nodes: [], edges: [] });
  });
});
