import { describe, it, expect } from 'vitest';
import { flowEdges, autoLayout, resolveLayout, edgePath } from './flowLayout.js';
import { END } from './flow.js';

const linear = [{ id: 'a', type: 'text' }, { id: 'b', type: 'text' }];

describe('flowEdges', () => {
  it('en flujo lineal, cada nodo apunta al siguiente y el último a END', () => {
    expect(flowEdges(linear)).toEqual([
      { from: 'a', to: 'b', label: null },
      { from: 'b', to: END, label: null },
    ]);
  });
  it('incluye las reglas etiquetadas con el valor, además del salto por defecto', () => {
    const qs = [
      { id: 'a', type: 'choice', rules: [{ equals: 'Ventas', goto: 'c' }], next: 'b' },
      { id: 'b', type: 'text' },
      { id: 'c', type: 'text' },
    ];
    const edges = flowEdges(qs);
    expect(edges).toContainEqual({ from: 'a', to: 'c', label: 'Ventas' });
    expect(edges).toContainEqual({ from: 'a', to: 'b', label: null });
  });
  it('el salto por defecto a END se representa como arista a END', () => {
    expect(flowEdges([{ id: 'a', next: END }])).toContainEqual({ from: 'a', to: END, label: null });
  });
  it('etiqueta las reglas con operador (p. ej. > 8, ≤ 5)', () => {
    const qs = [
      { id: 'a', type: 'scale', rules: [{ op: 'gt', value: 8, goto: 'b' }, { op: 'lte', value: 5, goto: 'c' }] },
      { id: 'b', type: 'text' }, { id: 'c', type: 'text' },
    ];
    const edges = flowEdges(qs);
    expect(edges).toContainEqual({ from: 'a', to: 'b', label: '> 8' });
    expect(edges).toContainEqual({ from: 'a', to: 'c', label: '≤ 5' });
  });
});

describe('autoLayout', () => {
  it('coloca los nodos en columna e incluye END al final', () => {
    const l = autoLayout(linear, { x: 60, y0: 40, gapY: 100 });
    expect(l.a).toEqual({ x: 60, y: 40 });
    expect(l.b).toEqual({ x: 60, y: 140 });
    expect(l[END]).toEqual({ x: 60, y: 240 });
  });
});

describe('resolveLayout', () => {
  it('usa la posición guardada si es válida y el auto-layout si no', () => {
    const l = resolveLayout(linear, { a: { x: 200, y: 300 }, b: { x: NaN, y: 5 } });
    expect(l.a).toEqual({ x: 200, y: 300 }); // guardada
    expect(l.b).toEqual(autoLayout(linear).b); // inválida → auto
  });
});

describe('edgePath', () => {
  it('devuelve un path SVG bezier entre los dos puntos', () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 10, y: 100 });
    expect(d).toMatch(/^M 0 0 C /);
    expect(d).toContain('10 100');
  });
});
