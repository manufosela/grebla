import { describe, it, expect } from 'vitest';
import { hasSeabed, seabedRef, seabedScene, seabedProgress, arrecifeOrder } from './seabed.js';

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

  it('seabedProgress marca visited/available/blocked y cuenta los encendidos', () => {
    const map = {
      id: 'seabed',
      cities: [
        { id: 'orchestration/a', name: 'A', kind: 'skill', area: 'z', x: 1, y: 2, weight: 3, prereqs: [] },
        { id: 'orchestration/b', name: 'B', kind: 'skill', area: 'z', x: 3, y: 4, weight: 2, prereqs: ['orchestration/a'] },
        { id: 'orchestration/c', name: 'C', kind: 'skill', area: 'z', x: 5, y: 6, weight: 2, prereqs: ['orchestration/b'] },
      ],
    };
    const journey = { visitedCities: ['orchestration/a'] };
    const { statusById, lit, total } = seabedProgress(map, journey);
    expect(statusById.get('orchestration/a')).toBe('visited'); // certificado → encendido
    expect(statusById.get('orchestration/b')).toBe('available'); // prereq cumplido
    expect(statusById.get('orchestration/c')).toBe('blocked'); // b aún no
    expect(lit).toBe(1);
    expect(total).toBe(3);
  });

  it('seabedProgress tolera mapa/journey vacíos', () => {
    expect(seabedProgress(null, null)).toEqual({ statusById: new Map(), lit: 0, total: 0 });
  });
});

describe('arrecifeOrder — número de orden por nivel de prereqs (rework B)', () => {
  it('nivel 1 los raíz, +1 por cada capa de prereqs', () => {
    const map = { cities: [
      { id: 'a', prereqs: [] },
      { id: 'b', prereqs: ['a'] },
      { id: 'c', prereqs: ['b'] },
      { id: 'd', prereqs: [] },              // otra raíz
      { id: 'e', prereqs: ['b', 'd'] },       // 1 + max(nivel b=2, nivel d=1) = 3
    ] };
    const order = arrecifeOrder(map);
    expect(order.get('a')).toBe(1);
    expect(order.get('d')).toBe(1);
    expect(order.get('b')).toBe(2);
    expect(order.get('c')).toBe(3);
    expect(order.get('e')).toBe(3);
  });

  it('ignora prereqs inexistentes y tolera vacío/ciclos', () => {
    expect(arrecifeOrder({ cities: [{ id: 'x', prereqs: ['fantasma'] }] }).get('x')).toBe(1);
    expect(arrecifeOrder(null).size).toBe(0);
    // ciclo preexistente: no cuelga
    const cyc = { cities: [{ id: 'p', prereqs: ['q'] }, { id: 'q', prereqs: ['p'] }] };
    expect(() => arrecifeOrder(cyc)).not.toThrow();
  });
});
