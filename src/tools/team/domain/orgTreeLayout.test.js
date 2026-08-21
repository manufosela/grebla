import { describe, it, expect } from 'vitest';
import { treeLayout } from './orgTreeLayout.js';

/** Organigrama de prueba: base (capa 0) → head (1) → dos ICs (2). */
const roles = [
  { id: 'base', label: 'CEO', branch: 'x', reportsToRoleId: null, layer: 0 },
  { id: 'head', label: 'Head', branch: 'x', reportsToRoleId: 'base', layer: 1 },
  { id: 'ic1', label: 'IC 1', branch: 'x', reportsToRoleId: 'head', layer: 2 },
  { id: 'ic2', label: 'IC 2', branch: 'x', reportsToRoleId: 'head', layer: 2 },
];
const at = (out, id) => out.nodes.find((n) => n.role.id === id);

describe('treeLayout — árbol INVERTIDO (RMR-TSK-0440)', () => {
  it('la base queda ABAJO y los sostenidos suben (y mayor = más abajo)', () => {
    const out = treeLayout(roles);
    expect(at(out, 'base').y).toBeGreaterThan(at(out, 'head').y);
    expect(at(out, 'head').y).toBeGreaterThan(at(out, 'ic1').y);
    expect(at(out, 'ic1').y).toBe(at(out, 'ic2').y); // misma capa, misma altura
  });

  it('cada padre queda centrado bajo sus hijos y los hermanos no se solapan', () => {
    const out = treeLayout(roles, { nodeWidth: 100, gapX: 20 });
    const [a, b] = [at(out, 'ic1'), at(out, 'ic2')];
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(100);
    expect(at(out, 'head').x).toBeCloseTo((a.x + b.x) / 2, 5);
  });

  it('una arista por dependencia real, con las coordenadas de sus dos extremos', () => {
    const out = treeLayout(roles);
    expect(out.links.map((l) => `${l.from}->${l.to}`).toSorted())
      .toEqual(['base->head', 'head->ic1', 'head->ic2']);
    const l = out.links.find((x) => x.to === 'head');
    expect(l.y1).toBe(at(out, 'base').y);
    expect(l.y2).toBe(at(out, 'head').y);
  });

  it('la capa MANDA sobre la profundidad: un IC de rama corta cae con los demás ICs', () => {
    // Data joven: el ingeniero cuelga del head (profundidad 1) pero es capa 2.
    const data = [...roles, { id: 'data-eng', label: 'Data Eng', branch: 'd', reportsToRoleId: 'base', layer: 2 }];
    const out = treeLayout(data);
    expect(at(out, 'data-eng').y).toBe(at(out, 'ic1').y);
  });

  it('dos roles de la MISMA capa con dependencia entre ellos se separan en la banda', () => {
    const pares = [
      { id: 'ceo', label: 'CEO', branch: 'x', reportsToRoleId: null, layer: 0 },
      { id: 'coceo', label: 'coCEO', branch: 'x', reportsToRoleId: 'ceo', layer: 0 },
    ];
    const out = treeLayout(pares);
    expect(at(out, 'ceo').y).toBeGreaterThan(at(out, 'coceo').y);
  });

  it('varias cimas caben (raíz virtual invisible) y un ciclo no cuelga el layout', () => {
    const multi = [
      { id: 'r1', label: 'R1', branch: 'x', reportsToRoleId: null, layer: 0 },
      { id: 'r2', label: 'R2', branch: 'y', reportsToRoleId: null, layer: 0 },
      { id: 'a', label: 'A', branch: 'x', reportsToRoleId: 'b', layer: 1 },
      { id: 'b', label: 'B', branch: 'x', reportsToRoleId: 'a', layer: 1 },
    ];
    const out = treeLayout(multi);
    expect(out.nodes.map((n) => n.role.id).toSorted()).toEqual(['a', 'b', 'r1', 'r2']);
    expect(out.nodes.every((n) => n.role.__virtual === undefined)).toBe(true);
  });

  it('lienzo dimensionado al contenido y coordenadas normalizadas a cero', () => {
    const out = treeLayout(roles, { nodeWidth: 100, rowHeight: 50 });
    expect(Math.min(...out.nodes.map((n) => n.x))).toBe(0);
    expect(Math.min(...out.nodes.map((n) => n.y))).toBe(0);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('sin roles devuelve un lienzo vacío', () => {
    expect(treeLayout([])).toEqual({ nodes: [], links: [], width: 0, height: 0 });
  });
});

describe('treeLayout — sin solapes dentro de la fila', () => {
  it('un rol que cambia de fila por su capa se aparta en vez de solaparse', () => {
    // El PM cuelga del CPO (profundidad 2) pero es capa 4: aterriza en la fila
    // de los ICs, donde d3 no contaba con él.
    const roles = [
      { id: 'base', label: 'coCEO', branch: 'x', reportsToRoleId: null, layer: 0 },
      { id: 'cpo', label: 'CPO', branch: 'p', reportsToRoleId: 'base', layer: 1 },
      { id: 'pm', label: 'PM', branch: 'p', reportsToRoleId: 'cpo', layer: 4 },
      { id: 'head', label: 'Head', branch: 'e', reportsToRoleId: 'cpo', layer: 2 },
      { id: 'em', label: 'EM', branch: 'e', reportsToRoleId: 'head', layer: 3 },
      { id: 'ic', label: 'IC', branch: 'e', reportsToRoleId: 'em', layer: 4 },
    ];
    const W = 100;
    const out = treeLayout(roles, { nodeWidth: W, gapX: 20 });
    const fila = out.nodes.filter((n) => n.y === out.nodes.find((x) => x.role.id === 'pm').y);
    expect(fila.map((n) => n.role.id).toSorted()).toEqual(['ic', 'pm']);
    const [a, b] = fila.toSorted((p, q) => p.x - q.x);
    expect(b.x - a.x).toBeGreaterThanOrEqual(W);
  });
});
