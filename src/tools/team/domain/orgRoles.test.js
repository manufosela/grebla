import { describe, it, expect } from 'vitest';
import { rootRoles, childrenOf, roleChain, wouldCycle, assertValidReportsTo, roleDepth, orgRoleRows, branchColor, layerColor } from './orgRoles.js';

/** @type {import('./orgRoles.js').OrgRole[]} */
const roles = [
  { id: 'cto', label: 'CTO', branch: 'engineering', reportsToRoleId: null },
  { id: 'head-eng', label: 'Head of Engineering', branch: 'engineering', reportsToRoleId: 'cto' },
  { id: 'em', label: 'Engineering Manager', branch: 'engineering', reportsToRoleId: 'head-eng' },
  { id: 'engineer', label: 'Engineer', branch: 'engineering', reportsToRoleId: 'em' },
  { id: 'cpo', label: 'CPO', branch: 'product', reportsToRoleId: null },
  { id: 'pm', label: 'Product Manager', branch: 'product', reportsToRoleId: 'cpo' },
  { id: 'head-data', label: 'Head of Data', branch: 'data', reportsToRoleId: null },
  { id: 'generico', label: 'Genérico', branch: 'generico', reportsToRoleId: null },
];

describe('rootRoles', () => {
  it('devuelve una cima por rama (y el genérico)', () => {
    expect(rootRoles(roles).map((r) => r.id).sort()).toEqual(['cpo', 'cto', 'generico', 'head-data']);
  });
});

describe('childrenOf', () => {
  it('lista los roles que reportan a uno dado', () => {
    expect(childrenOf(roles, 'cto').map((r) => r.id)).toEqual(['head-eng']);
    expect(childrenOf(roles, 'head-data')).toEqual([]); // Head of Data sin managers debajo
  });
});

describe('roleChain', () => {
  it('sube desde un rol hasta su cima', () => {
    expect(roleChain(roles, 'engineer').map((r) => r.id)).toEqual(['engineer', 'em', 'head-eng', 'cto']);
  });
  it('una cima es su propia cadena', () => {
    expect(roleChain(roles, 'cpo').map((r) => r.id)).toEqual(['cpo']);
  });
});

describe('roleDepth', () => {
  it('0 en la cima, crece hacia abajo', () => {
    expect(roleDepth(roles, 'cto')).toBe(0);
    expect(roleDepth(roles, 'engineer')).toBe(3);
  });
});

describe('wouldCycle', () => {
  it('detecta autodependencia', () => {
    expect(wouldCycle(roles, 'em', 'em')).toBe(true);
  });
  it('detecta ciclo indirecto (poner un ancestro a depender de un descendiente)', () => {
    // cto pasaría a depender de engineer, que ya cuelga de cto → ciclo.
    expect(wouldCycle(roles, 'cto', 'engineer')).toBe(true);
  });
  it('permite reasignaciones válidas', () => {
    expect(wouldCycle(roles, 'em', 'cto')).toBe(false); // saltar un nivel: válido
    expect(wouldCycle(roles, 'head-data', null)).toBe(false);
  });
  it('INVERTIR jerarquía es válido: Head deja de colgar de CTO y CTO cuelga de Head', () => {
    // 1) Head pasa a cima (parent null) — trivialmente sin ciclo.
    expect(wouldCycle(roles, 'head-eng', null)).toBe(false);
    // 2) sobre ese estado, CTO cuelga de Head → sin ciclo.
    const inverted = roles.map((r) => (r.id === 'head-eng' ? { ...r, reportsToRoleId: null } : r));
    expect(wouldCycle(inverted, 'cto', 'head-eng')).toBe(false);
  });
});

describe('assertValidReportsTo', () => {
  it('no lanza en una reasignación válida', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'cto')).not.toThrow();
  });
  it('lanza en autodependencia', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'em')).toThrow(/sí mismo/);
  });
  it('lanza si el superior no existe', () => {
    expect(() => assertValidReportsTo(roles, 'em', 'inexistente')).toThrow(/no existe/);
  });
  it('lanza si crea ciclo', () => {
    expect(() => assertValidReportsTo(roles, 'cto', 'engineer')).toThrow(/ciclo/);
  });
});

describe('orgRoleRows — orden por DEPENDENCIAS (no por rama)', () => {
  it('cada árbol contiguo en post-orden: hojas arriba, la base al final del bloque', () => {
    const rows = orgRoleRows(roles);
    expect(rows.map((r) => r.role.id)).toEqual([
      'engineer', 'em', 'head-eng', 'cto', 'pm', 'cpo', 'head-data', 'generico',
    ]);
  });

  it('una dependencia que CRUZA de rama mantiene la cadena junta (head-eng→cpo: cpo debajo)', () => {
    // El caso reportado: Head of Engineering (engineering) depende de CPO (product).
    const crossed = roles.map((r) => (r.id === 'head-eng' ? { ...r, reportsToRoleId: 'cpo' } : r));
    const ids = orgRoleRows(crossed).map((r) => r.role.id);
    // El árbol de cpo sale contiguo, con TODA la cadena de head-eng dentro y cpo al final (la base).
    expect(ids).toEqual(['cto', 'engineer', 'em', 'head-eng', 'pm', 'cpo', 'head-data', 'generico']);
    // Y cpo va justo después (debajo) de sus dependientes head-eng/pm, no en otro bloque.
    expect(ids.indexOf('cpo')).toBeGreaterThan(ids.indexOf('head-eng'));
    expect(ids.indexOf('cpo')).toBe(ids.indexOf('pm') + 1);
  });

  it('marca firstOfTree solo en la primera fila de cada árbol', () => {
    const rows = orgRoleRows(roles);
    expect(rows.filter((r) => r.firstOfTree).map((r) => r.role.id)).toEqual([
      'engineer', 'pm', 'head-data', 'generico',
    ]);
  });

  it('los roles en un ciclo preexistente (huérfanos de cima) salen igualmente al final', () => {
    const cyc = [
      ...roles,
      { id: 'a', label: 'A', branch: 'generico', reportsToRoleId: 'b' },
      { id: 'b', label: 'B', branch: 'generico', reportsToRoleId: 'a' },
    ];
    const ids = orgRoleRows(cyc).map((r) => r.role.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});

describe('branchColor — color estable por rama (var override + fallback determinista)', () => {
  it('canónicas: var(--rm-branch-<id>, color de marca)', () => {
    expect(branchColor('engineering')).toBe('var(--rm-branch-engineering, #2a9d8f)');
    expect(branchColor('product')).toBe('var(--rm-branch-product, #e76f51)');
    expect(branchColor('data')).toBe('var(--rm-branch-data, #457b9d)');
  });

  it('rama creada: fallback HSL determinista (mismo id → mismo color)', () => {
    const c1 = branchColor('directiva');
    expect(c1).toMatch(/^var\(--rm-branch-directiva, hsl\(\d+ 55% 58%\)\)$/);
    expect(branchColor('directiva')).toBe(c1); // estable
    expect(branchColor('operaciones')).not.toBe(c1); // ids distintos, colores distintos
  });

  it('tolera id vacío cayendo al genérico', () => {
    expect(branchColor('')).toBe('var(--rm-branch-generico, #6b7280)');
  });
});

describe('layerColor — color por capa de la pirámide (RMR-BUG-0072)', () => {
  it('la base (0) es el acento y cada capa tiene tono propio, cíclico', () => {
    expect(layerColor(0)).toBe('#2a9d8f');
    expect(layerColor(1)).not.toBe(layerColor(0));
    expect(layerColor(2)).not.toBe(layerColor(1));
    expect(layerColor(6)).toBe(layerColor(0)); // ciclo de 6
  });
  it('tolera profundidades inválidas cayendo a la base', () => {
    expect(layerColor(-1)).toBe(layerColor(0));
    expect(layerColor(undefined)).toBe(layerColor(0));
  });
});
