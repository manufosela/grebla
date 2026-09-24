import { describe, it, expect } from 'vitest';
import { ROLE_MIRROR_BRANCHES, inRoleMirrorScope, roleMirrorPeople } from './roleMirrorScope.js';

/**
 * Role Mirror es de ingeniería (RMR-TSK-0560): su marco de roles habla de cómo
 * trabaja un equipo técnico, así que la lista no puede ofrecer a cualquiera que
 * se haya logado.
 */
describe('inRoleMirrorScope', () => {
  it('entra ingeniería, y también quien la gestiona', () => {
    expect(ROLE_MIRROR_BRANCHES).toEqual(['engineering', 'engineering-manager']);
    expect(inRoleMirrorScope({ orgBranch: 'engineering' })).toBe(true);
    expect(inRoleMirrorScope({ orgBranch: 'engineering-manager' })).toBe(true);
  });

  it('no entran otras ramas', () => {
    for (const rama of ['product', 'people', 'data', 'executive']) {
      expect(inRoleMirrorScope({ orgBranch: rama })).toBe(false);
    }
  });

  it('sin rama declarada tampoco: quien acaba de entrar y aún no está clasificado no se evalúa', () => {
    expect(inRoleMirrorScope({ orgBranch: 'generico' })).toBe(false);
    expect(inRoleMirrorScope({})).toBe(false);
    expect(inRoleMirrorScope(null)).toBe(false);
  });
});

describe('roleMirrorPeople', () => {
  it('deja solo a quien procede, conservando el orden', () => {
    const gente = [
      { id: 'a', orgBranch: 'engineering' },
      { id: 'b', orgBranch: 'product' },
      { id: 'c', orgBranch: 'generico' },
      { id: 'd', orgBranch: 'engineering-manager' },
    ];
    expect(roleMirrorPeople(gente).map((p) => p.id)).toEqual(['a', 'd']);
    expect(roleMirrorPeople(null)).toEqual([]);
  });
});
