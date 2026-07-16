/**
 * Tests de las formas de casa por comarca (RMR-TSK-0233): asignación determinista
 * por comarca y generación del path SVG. Puro, sin DOM.
 */
import { describe, it, expect } from 'vitest';
import { HOUSE_SHAPES, shapeForArea, houseShapePath } from './houseShapes.js';

const areas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('shapeForArea', () => {
  it('asigna la forma por la posición de la comarca', () => {
    expect(shapeForArea('a', areas)).toBe(HOUSE_SHAPES[0]);
    expect(shapeForArea('b', areas)).toBe(HOUSE_SHAPES[1]);
    expect(shapeForArea('c', areas)).toBe(HOUSE_SHAPES[2]);
  });

  it('es determinista: misma comarca → misma forma', () => {
    expect(shapeForArea('b', areas)).toBe(shapeForArea('b', areas));
  });

  it('cicla cuando hay más comarcas que formas', () => {
    const many = Array.from({ length: HOUSE_SHAPES.length + 1 }, (_, i) => ({ id: `x${i}` }));
    // La comarca en posición HOUSE_SHAPES.length vuelve a la primera forma.
    expect(shapeForArea(`x${HOUSE_SHAPES.length}`, many)).toBe(HOUSE_SHAPES[0]);
  });

  it('sin comarca o comarca desconocida → forma base', () => {
    expect(shapeForArea('', areas)).toBe(HOUSE_SHAPES[0]);
    expect(shapeForArea(null, areas)).toBe(HOUSE_SHAPES[0]);
    expect(shapeForArea('zzz', areas)).toBe(HOUSE_SHAPES[0]);
    expect(shapeForArea('a', null)).toBe(HOUSE_SHAPES[0]);
  });
});

describe('houseShapePath', () => {
  it('devuelve un path que empieza en M para las siluetas', () => {
    for (const shape of ['house', 'hut', 'tipi', 'leanto']) {
      const d = houseShapePath(shape, 50, 50, 2);
      expect(d.startsWith('M ')).toBe(true);
      expect(d.length).toBeGreaterThan(0);
    }
  });

  it("la choza usa un arco (A) y las demás son polígonos (Z sin A)", () => {
    expect(houseShapePath('hut', 10, 10, 2)).toContain(' A ');
    expect(houseShapePath('tipi', 10, 10, 2)).not.toContain(' A ');
    expect(houseShapePath('house', 10, 10, 2)).toContain(' Z');
  });

  it('circle y formas desconocidas devuelven cadena vacía (el llamante usa <circle>)', () => {
    expect(houseShapePath('circle', 10, 10, 2)).toBe('');
    expect(houseShapePath('nope', 10, 10, 2)).toBe('');
  });

  it('centra la silueta en (cx, cy): el tipi tiene su vértice arriba', () => {
    // vértice superior del tipi: (cx, cy - r)
    expect(houseShapePath('tipi', 10, 20, 3)).toContain('M 10 17 ');
  });
});
