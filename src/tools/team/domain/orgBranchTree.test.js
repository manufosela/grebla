import { describe, it, expect } from 'vitest';
import { branchTree, branchTreeLayout } from './orgBranchTree.js';

const p = (personId, level, reportsToPersonId, extra = {}) => ({
  personId, name: personId, orgBranch: 'tech', reportsToPersonId,
  notion: { level, role: `${level} ${personId}`, team: extra.team ?? null }, ...extra,
});

// CEO (fuera de Tech) ← CTO ← Head ← Manager ← (ICs de Backend y Mobile) · Lead ← IC de Data
const people = [
  p('ceo', 'C-level', null, { orgBranch: 'exec' }),
  p('cto', 'C-level', 'ceo'),
  p('head', 'Head of', 'cto'),
  p('mgr', 'Manager', 'head'),
  p('lead', 'Lead', 'head'),
  p('ana', 'Individual Contributor', 'mgr', { team: 'Backend' }),
  p('bea', 'Individual Contributor', 'mgr', { team: 'Backend' }),
  p('carla', 'Individual Contributor', 'mgr', { team: 'Mobile' }),
  p('dani', 'Individual Contributor', 'lead', { team: 'Data' }),
  p('eva', 'Individual Contributor', 'cto'),
];

describe('branchTree (RMR-TSK-0670)', () => {
  it('una rama: quien depende de otra rama es raíz; los IC se agrupan en cajas por jefe y equipo', () => {
    const tree = branchTree(people, 'tech');
    expect(tree.roots.map((n) => n.id)).toEqual(['cto']);
    const boxes = tree.nodes.filter((n) => n.kind === 'team');
    expect(boxes.map((b) => [b.parentId, b.label, b.count]).toSorted()).toEqual([
      ['cto', 'Sin equipo', 1], ['lead', 'Data', 1], ['mgr', 'Backend', 2], ['mgr', 'Mobile', 1],
    ]);
    expect(tree.nodes.some((n) => n.id === 'ana')).toBe(false);
  });

  it('filas: C-level abajo, encima Head of, Manager, Lead y las cajas arriba del todo', () => {
    const tree = branchTree(people, 'tech');
    const row = (id) => tree.nodes.find((n) => n.id === id).row;
    expect([row('cto'), row('head'), row('mgr'), row('lead')]).toEqual([0, 1, 2, 3]);
    expect(new Set(tree.nodes.filter((n) => n.kind === 'team').map((n) => n.row))).toEqual(new Set([4]));
    expect(tree.bands.map((b) => b.label)).toEqual(['C-level', 'Head of', 'Manager', 'Lead', 'Equipos']);
  });

  it('dos del mismo nivel, uno del otro, se apilan dentro de su banda', () => {
    const tree = branchTree(people, null);
    expect(['ceo', 'cto', 'head'].map((id) => tree.nodes.find((n) => n.id === id).row)).toEqual([0, 1, 2]);
    expect(tree.bands[0]).toEqual({ label: 'C-level', fromRow: 0, toRow: 1 });
  });

  it('sin Level de Notion (la demo), quien tiene gente a cargo sube una fila sobre su jefe', () => {
    const tree = branchTree([p('jefa', null, null), p('mando', null, 'jefa'), p('dev', null, 'mando')], 'tech');
    expect(tree.nodes.map((n) => [n.id, n.row])).toEqual([['jefa', 0], ['mando', 1], ['team:mando:Sin equipo', 2]]);
  });
});

describe('branchTreeLayout (RMR-TSK-0670)', () => {
  const SIZE = { nodeWidth: 200, nodeHeight: 64, gapX: 20, rowHeight: 120 };
  const rectOf = (n) => ({ x1: n.x - 100, x2: n.x + 100, y1: n.y - 32, y2: n.y + 32 });
  const segments = (d) => {
    const [, x0, y0, yBus, xEnd, yEnd] = d.match(/M ([\d.]+) ([\d.]+) V ([\d.]+) H ([\d.]+) V ([\d.]+)/).map(Number);
    return [[x0, y0, x0, yBus], [x0, yBus, xEnd, yBus], [xEnd, yBus, xEnd, yEnd]];
  };
  const hits = ([ax, ay, bx, by], r) => Math.max(ax, bx) > r.x1 && Math.min(ax, bx) < r.x2 && Math.max(ay, by) > r.y1 && Math.min(ay, by) < r.y2;

  it('la base abajo, nadie se pisa y ninguna línea atraviesa otra tarjeta', () => {
    const layout = branchTreeLayout(branchTree(people, null), SIZE);
    const at = (id) => layout.nodes.find((n) => n.id === id);
    expect(at('ceo').y).toBeGreaterThan(at('cto').y);
    const sameRow = layout.nodes.flatMap((a) => layout.nodes.filter((b) => a !== b && a.y === b.y).map((b) => Math.abs(a.x - b.x)));
    expect(Math.min(...sameRow)).toBeGreaterThanOrEqual(SIZE.nodeWidth);
    const crossings = layout.links.flatMap((link) => layout.nodes
      .filter((n) => n.id !== link.from && n.id !== link.to && segments(link.d).some((s) => hits(s, rectOf(n))))
      .map((n) => `${link.from}→${link.to} cruza ${n.id}`));
    expect(crossings).toEqual([]);
    expect(layout.links).toHaveLength(layout.nodes.length - 1);
  });

  it('un ciclo en el directorio se corta y se pinta igual', () => {
    const cycle = [p('a', 'Manager', 'b'), p('b', 'Manager', 'a'), p('c', 'Individual Contributor', 'a')];
    expect(branchTreeLayout(branchTree(cycle, 'tech'), SIZE).nodes).toHaveLength(3);
  });
});
