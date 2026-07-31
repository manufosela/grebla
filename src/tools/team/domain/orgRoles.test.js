import { describe, it, expect } from 'vitest';
import { rootRoles, childrenOf, roleChain, wouldCycle, assertValidReportsTo, roleDepth } from './orgRoles.js';

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
