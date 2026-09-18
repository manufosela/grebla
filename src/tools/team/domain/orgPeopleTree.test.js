import { describe, it, expect } from 'vitest';
import { buildPeopleTree, personTitle, peopleTreeLayout, splitLoose, leafColumns } from './orgPeopleTree.js';

const p = (personId, name, reportsToPersonId = null, extra = {}) => ({ personId, name, reportsToPersonId, ...extra });

describe('buildPeopleTree', () => {
  it('quien no reporta a nadie es raíz y los demás cuelgan de su manager', () => {
    const { roots, total } = buildPeopleTree([p('ceo', 'Paloma'), p('cto', 'Mánu', 'ceo'), p('eng', 'Ana', 'cto')]);
    expect(total).toBe(3);
    expect(roots.map((r) => r.person.name)).toEqual(['Paloma']);
    expect(roots[0].children[0].person.name).toBe('Mánu');
    expect(roots[0].children[0].children[0].person.name).toBe('Ana');
    expect(roots[0].children[0].children[0].depth).toBe(2);
    expect(roots[0].reports).toBe(2);
  });

  it('un manager que no está en el censo deja a la persona como raíz huérfana: nadie desaparece', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('x', 'Sin jefe', 'baja')]);
    expect(roots.map((r) => [r.person.name, r.orphan])).toEqual([['Paloma', false], ['Sin jefe', true]]);
  });

  it('los hijos van primero los que tienen equipo y luego por nombre', () => {
    const { roots } = buildPeopleTree([
      p('ceo', 'Paloma'), p('z', 'Zoe', 'ceo'), p('a', 'Ana', 'ceo'), p('m', 'Marta', 'ceo'), p('h', 'Hugo', 'm'),
    ]);
    expect(roots[0].children.map((c) => c.person.name)).toEqual(['Marta', 'Ana', 'Zoe']);
  });

  it('un ciclo en los datos no cuelga nada: se corta y sale como raíz huérfana', () => {
    const { roots, total } = buildPeopleTree([p('a', 'Ana', 'b'), p('b', 'Bea', 'a'), p('ceo', 'Paloma')]);
    expect(total).toBe(3);
    const names = roots.map((r) => r.person.name);
    expect(names).toContain('Paloma');
    expect(names).toContain('Ana');
    const ana = roots.find((r) => r.person.name === 'Ana');
    expect(ana.orphan).toBe(true);
    expect(ana.children.map((c) => c.person.name)).toEqual(['Bea']);
  });

  it('reportar a uno mismo es ser raíz huérfana, y sin nombre o sin id no se entra', () => {
    const { roots, total } = buildPeopleTree([p('a', 'Ana', 'a'), p('', 'Nadie'), p('b', '')]);
    expect(total).toBe(1);
    expect(roots[0].orphan).toBe(true);
    expect(roots[0].children).toEqual([]);
  });
});

describe('personTitle', () => {
  const labels = new Map([['em', 'Engineering Manager']]);
  it('el puesto de Notion manda; si no hay, el rótulo del rol GREBLA; si no, nada', () => {
    expect(personTitle({ orgRole: 'em', notion: { role: 'Tech Lead' } }, labels)).toBe('Tech Lead');
    expect(personTitle({ orgRole: 'em' }, labels)).toBe('Engineering Manager');
    expect(personTitle({ orgRole: 'em' }, { em: 'EM' })).toBe('EM');
    expect(personTitle({ orgRole: 'desconocido' }, labels)).toBe('');
    expect(personTitle({}, labels)).toBe('');
  });
});

describe('splitLoose', () => {
  it('las raíces con equipo forman el árbol; las que no tienen a nadie van sueltas, huérfanas o no', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('a', 'Ana', 'ceo'), p('x', 'Fuera'), p('y', 'Sin jefe', 'baja')]);
    const { tree, loose } = splitLoose(roots);
    expect(tree.map((r) => r.person.name)).toEqual(['Paloma']);
    expect(loose.map((r) => [r.person.name, r.orphan])).toEqual([['Fuera', false], ['Sin jefe', true]]);
  });
});

describe('leafColumns', () => {
  it('hasta tres en línea; de cuatro a ocho, tres columnas; más, cuatro', () => {
    expect([0, 1, 3, 4, 8, 9, 20].map(leafColumns)).toEqual([0, 1, 3, 3, 3, 4, 4]);
  });
});

describe('peopleTreeLayout', () => {
  const O = { nodeWidth: 100, nodeHeight: 50, gapX: 20, rowHeight: 100 };
  const at = (nodes, name) => nodes.find((n) => n.node.person.name === name);

  it('las raíces arriba, cada nivel más abajo, sin solapes y con una arista trazada por relación', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('a', 'Ana', 'ceo'), p('b', 'Bea', 'ceo'), p('c', 'Cris', 'a')]);
    const { nodes, links, width, height } = peopleTreeLayout(roots, O);
    expect(at(nodes, 'Paloma').y).toBeLessThan(at(nodes, 'Ana').y);
    expect(at(nodes, 'Ana').y).toBe(at(nodes, 'Bea').y);
    expect(at(nodes, 'Cris').y).toBeGreaterThan(at(nodes, 'Ana').y);
    expect(Math.abs(at(nodes, 'Ana').x - at(nodes, 'Bea').x)).toBeGreaterThanOrEqual(120);
    expect(links).toHaveLength(3);
    expect(links.find((l) => l.to === 'c')).toMatchObject({ from: 'a' });
    expect(links.every((l) => /^M[\d.]+,[\d.]+ V/.test(l.d))).toBe(true);
    expect(nodes.every((n) => n.x >= 50)).toBe(true);
    expect(width).toBe(220); // Ana (con Cris debajo) y Bea, una columna cada una
    expect(height).toBe(250); // tres filas: dos saltos de 100 y la caja de la última
  });

  it('un equipo grande de hojas se apila en rejilla bajo su manager en vez de en línea', () => {
    const people = [p('m', 'Marta'), ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => p(id, `Hoja ${id}`, 'm'))];
    const { roots } = buildPeopleTree(people);
    const { nodes, links, width, height } = peopleTreeLayout(roots, O);
    expect(width).toBe(352); // tres columnas (y la espina), no seis
    expect(height).toBe(250); // manager + dos filas de hojas
    const ys = new Set(nodes.filter((n) => n.node.person.name.startsWith('Hoja')).map((n) => n.y));
    expect([...ys].sort((a, b) => a - b)).toEqual([125, 225]);
    expect(at(nodes, 'Marta').x).toBe(176); // centrada sobre la rejilla
    expect(links).toHaveLength(6);
    // Las hojas de la segunda fila entran por la espina lateral, no atravesando la primera fila.
    expect(links.find((l) => l.to === 'd').d).toMatch(/ H[\d.]+ V[\d.]+ H[\d.]+$/);
  });

  it('los hijos con equipo van antes que la rejilla de hojas y cada bloque tiene su sitio', () => {
    const { roots } = buildPeopleTree([p('m', 'Marta'), p('h1', 'Hoja 1', 'm'), p('b', 'Bea', 'm'), p('bb', 'Nieta', 'b')]);
    const { nodes } = peopleTreeLayout(roots, O);
    expect(at(nodes, 'Bea').x).toBeLessThan(at(nodes, 'Hoja 1').x);
    expect(at(nodes, 'Nieta').x).toBe(at(nodes, 'Bea').x);
  });

  it('varias raíces conviven sin arista entre ellas', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('a', 'Ana', 'ceo'), p('x', 'Otra', ''), p('y', 'Yo', 'x')]);
    const { nodes, links } = peopleTreeLayout(roots, O);
    expect(nodes).toHaveLength(4);
    expect(links).toHaveLength(2);
    expect(at(nodes, 'Paloma').y).toBe(at(nodes, 'Otra').y);
  });

  it('sin personas, nada', () => {
    expect(peopleTreeLayout([])).toEqual({ nodes: [], links: [], width: 0, height: 0 });
  });
});
