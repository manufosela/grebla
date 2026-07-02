import { describe, it, expect } from 'vitest';
import { isoProject, depthSort, isoBounds, areaCentroid, TILE_W, TILE_H, Z_H } from './iso.js';

describe('iso projection', () => {
  it('constantes con ratio isométrico 2:1', () => {
    expect(TILE_W).toBe(24);
    expect(TILE_H).toBe(12);
    expect(TILE_W).toBe(TILE_H * 2);
    expect(Z_H).toBe(10);
  });

  it('isoProject: origen y ejes conocidos', () => {
    expect(isoProject(0, 0)).toEqual({ sx: 0, sy: 0 });
    // eje x puro → hacia la derecha y abajo
    expect(isoProject(2, 0)).toEqual({ sx: 24, sy: 12 });
    // eje y puro → hacia la izquierda y abajo (espejo del eje x)
    expect(isoProject(0, 2)).toEqual({ sx: -24, sy: 12 });
    // diagonal x==y → columna central, sólo profundidad
    expect(isoProject(1, 1)).toEqual({ sx: 0, sy: 12 });
  });

  it('isoProject: z eleva el punto (resta a sy)', () => {
    expect(isoProject(0, 0, 1)).toEqual({ sx: 0, sy: -10 });
    expect(isoProject(0, 0, 3)).toEqual({ sx: 0, sy: -30 });
  });

  it('isoProject: opts sobreescriben las constantes', () => {
    expect(isoProject(2, 0, 0, { tileW: 10 })).toEqual({ sx: 10, sy: 12 });
    expect(isoProject(0, 0, 1, { zH: 4 })).toEqual({ sx: 0, sy: -4 });
  });

  it('depthSort: ordena de fondo (menor x+y) a frente (mayor x+y)', () => {
    const cities = [
      { id: 'front', x: 5, y: 5 }, // 10
      { id: 'back', x: 0, y: 0 }, // 0
      { id: 'mid', x: 2, y: 1 }, // 3
    ];
    expect(depthSort(cities).map((c) => c.id)).toEqual(['back', 'mid', 'front']);
  });

  it('depthSort: estable ante empates y no muta el original', () => {
    const cities = [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 2, y: 0 }, // mismo x+y que 'a'
      { id: 'c', x: 0, y: 0 },
    ];
    expect(depthSort(cities).map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(cities.map((c) => c.id)).toEqual(['a', 'b', 'c']); // original intacto
  });

  it('depthSort: tolera entrada vacía o nula', () => {
    expect(depthSort([])).toEqual([]);
    expect(depthSort(undefined)).toEqual([]);
  });

  it('isoBounds: caja envolvente de puntos proyectados', () => {
    const pts = [
      { sx: -24, sy: 12 },
      { sx: 24, sy: 12 },
      { sx: 0, sy: -10 },
      { sx: 0, sy: 30 },
    ];
    expect(isoBounds(pts)).toEqual({ minX: -24, minY: -10, maxX: 24, maxY: 30 });
  });

  it('isoBounds: null si no hay puntos', () => {
    expect(isoBounds([])).toBeNull();
    expect(isoBounds(undefined)).toBeNull();
  });

  it('areaCentroid: media proyectada de las ciudades de la comarca', () => {
    const map = {
      cities: [
        { id: 'a', area: 'z', x: 0, y: 0 },
        { id: 'b', area: 'z', x: 2, y: 0 },
        { id: 'c', area: 'w', x: 10, y: 10 },
      ],
    };
    // proyecciones z: (0,0)->{0,0}, (2,0)->{24,12}; media = {12,6}
    expect(areaCentroid(map, 'z')).toEqual({ sx: 12, sy: 6 });
  });

  it('areaCentroid: null si la comarca no tiene ciudades', () => {
    expect(areaCentroid({ cities: [] }, 'z')).toBeNull();
    expect(areaCentroid({ cities: [{ id: 'a', area: 'x', x: 0, y: 0 }] }, 'z')).toBeNull();
  });
});
