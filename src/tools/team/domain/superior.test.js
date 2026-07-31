import { describe, it, expect } from 'vitest';
import { personRole, resolveSuperior } from './superior.js';

/** @type {import('./superior.js').LeaderLike[]} */
const leaders = [
  { uid: 'mgr-1', displayName: 'Manager Uno', email: 'm1@x', reportsTo: 'head-1' },
  { uid: 'mgr-2', displayName: 'Manager Dos', email: 'm2@x', reportsTo: null },
];
const heads = [
  { uid: 'head-1', displayName: 'Head Uno', email: 'h1@x' },
  { uid: 'head-2', displayName: 'Head Dos', email: 'h2@x' },
];

describe('personRole', () => {
  it('una persona sin cuenta vinculada es engineer', () => {
    expect(personRole({ uid: null }, leaders, heads)).toBe('engineer');
    expect(personRole({}, leaders, heads)).toBe('engineer');
  });

  it('una persona cuyo uid está en leaders es manager', () => {
    expect(personRole({ uid: 'mgr-1' }, leaders, heads)).toBe('manager');
  });

  it('una persona cuyo uid está en supermanagers es head', () => {
    expect(personRole({ uid: 'head-2' }, leaders, heads)).toBe('head');
  });

  it('head tiene precedencia sobre manager si el uid está en ambos', () => {
    const both = [{ uid: 'head-1', displayName: 'X', email: null, reportsTo: null }];
    expect(personRole({ uid: 'head-1' }, both, heads)).toBe('head');
  });

  it('un uid que no está en ninguna colección es engineer', () => {
    expect(personRole({ uid: 'eng-9' }, leaders, heads)).toBe('engineer');
  });
});

describe('resolveSuperior', () => {
  it('engineer: superior es su manager (ownerLeaderUid), transferible', () => {
    const r = resolveSuperior({ uid: 'eng-9', ownerLeaderUid: 'mgr-1' }, { leaders, heads });
    expect(r).toEqual({
      role: 'engineer',
      superiorKind: 'manager',
      superiorUid: 'mgr-1',
      emptyLabel: 'Sin manager',
      canTransfer: true,
    });
  });

  it('engineer sin manager: superiorUid null y etiqueta «Sin manager»', () => {
    const r = resolveSuperior({ uid: 'eng-9' }, { leaders, heads });
    expect(r.superiorUid).toBeNull();
    expect(r.emptyLabel).toBe('Sin manager');
    expect(r.canTransfer).toBe(true);
  });

  it('manager: superior es su head (reportsTo), etiqueta «Sin head», transferible', () => {
    const r = resolveSuperior({ uid: 'mgr-1', ownerLeaderUid: 'otro' }, { leaders, heads });
    expect(r).toEqual({
      role: 'manager',
      superiorKind: 'head',
      superiorUid: 'head-1',
      emptyLabel: 'Sin head',
      canTransfer: true,
    });
  });

  it('manager sin head (reportsTo null): superiorUid null, nunca «Sin manager»', () => {
    const r = resolveSuperior({ uid: 'mgr-2' }, { leaders, heads });
    expect(r.role).toBe('manager');
    expect(r.superiorUid).toBeNull();
    expect(r.emptyLabel).toBe('Sin head');
  });

  it('head: sin superior (CTO no existe), no transferible', () => {
    const r = resolveSuperior({ uid: 'head-1' }, { leaders, heads });
    expect(r).toEqual({
      role: 'head',
      superiorKind: 'none',
      superiorUid: null,
      emptyLabel: 'Sin superior',
      canTransfer: false,
    });
  });
});
