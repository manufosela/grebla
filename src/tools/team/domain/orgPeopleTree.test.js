import { describe, it, expect } from 'vitest';
import { buildPeopleTree, personTitle, peopleTreeLayout } from './orgPeopleTree.js';

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

describe('peopleTreeLayout', () => {
  it('las raíces arriba, cada nivel más abajo, sin solapes y con una arista por relación', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('a', 'Ana', 'ceo'), p('b', 'Bea', 'ceo'), p('c', 'Cris', 'a')]);
    const { nodes, links, width, height } = peopleTreeLayout(roots, { nodeWidth: 100, nodeHeight: 50, gapX: 20, rowHeight: 100 });
    const at = (name) => nodes.find((n) => n.node.person.name === name);
    expect(at('Paloma').y).toBeLessThan(at('Ana').y);
    expect(at('Ana').y).toBe(at('Bea').y);
    expect(at('Cris').y).toBeGreaterThan(at('Ana').y);
    expect(Math.abs(at('Ana').x - at('Bea').x)).toBeGreaterThanOrEqual(120);
    expect(links).toHaveLength(3);
    expect(links.find((l) => l.to === 'c').from).toBe('a');
    expect(nodes.every((n) => n.x >= 50)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBe(250); // tres filas: dos saltos de 100 y la caja de la última
  });

  it('varias raíces conviven sin arista entre ellas', () => {
    const { roots } = buildPeopleTree([p('ceo', 'Paloma'), p('x', 'Suelto', 'baja')]);
    const { nodes, links } = peopleTreeLayout(roots);
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(0);
    expect(nodes[0].y).toBe(nodes[1].y);
  });

  it('sin personas, nada', () => {
    expect(peopleTreeLayout([])).toEqual({ nodes: [], links: [], width: 0, height: 0 });
  });
});
