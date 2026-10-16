import { describe, it, expect } from 'vitest';
import { ROLE_MIRROR_BRANCHES, inRoleMirrorScope, roleMirrorPeople, withRoleMirrorTab } from './roleMirrorScope.js';

describe('withRoleMirrorTab: la pestaña Role Mirror de la ficha (RMR-TSK-0734)', () => {
  const tabs = [{ id: 'datos' }, { id: 'carrera' }, { id: 'o2o' }];
  it('a quien entra en Role Mirror se le añade tras Carrera', () => {
    expect(withRoleMirrorTab(tabs, { person: { orgBranch: 'engineering' }, isSelf: false }).map((t) => t.id))
      .toEqual(['datos', 'carrera', 'rolemirror', 'o2o']);
  });
  it('ni en la propia ficha, ni a externos, ni fuera de ingeniería', () => {
    expect(withRoleMirrorTab(tabs, { person: { orgBranch: 'engineering' }, isSelf: true })).toEqual(tabs);
    expect(withRoleMirrorTab(tabs, { person: { orgBranch: 'engineering', external: true }, isSelf: false })).toEqual(tabs);
    expect(withRoleMirrorTab(tabs, { person: { orgBranch: 'product' }, isSelf: false })).toEqual(tabs);
  });
});

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
