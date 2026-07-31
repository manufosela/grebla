import { describe, it, expect } from 'vitest';
import { matchesGrant, canUseTool, canManageTool, visibleToolIds } from './toolAccess.js';

const engineer = { personId: 'p1', branch: 'engineering', roleId: 'engineer' };
const pm = { personId: 'p2', branch: 'product', roleId: 'pm' };
const cpeople = { personId: 'p3', branch: 'people', roleId: 'cpeople' };

/** @type {import('./toolAccess.js').ToolPolicy[]} */
const policies = [
  { toolId: 'marea', audience: { everyone: true }, managedBy: {} },
  { toolId: 'dora', audience: { branches: ['engineering'] }, managedBy: { roleIds: ['head-eng'] } },
  { toolId: 'surveys', audience: { everyone: true }, managedBy: { branches: ['people'] } },
];

describe('matchesGrant', () => {
  it('everyone concede a cualquiera', () => {
    expect(matchesGrant({ everyone: true }, pm)).toBe(true);
  });
  it('por rama', () => {
    expect(matchesGrant({ branches: ['engineering'] }, engineer)).toBe(true);
    expect(matchesGrant({ branches: ['engineering'] }, pm)).toBe(false);
  });
  it('por rol', () => {
    expect(matchesGrant({ roleIds: ['pm'] }, pm)).toBe(true);
  });
  it('por personId explícito (acceso puntual cruzando ramas)', () => {
    expect(matchesGrant({ branches: ['engineering'], personIds: ['p2'] }, pm)).toBe(true);
  });
  it('grant vacío no concede', () => {
    expect(matchesGrant({}, engineer)).toBe(false);
    expect(matchesGrant(null, engineer)).toBe(false);
  });
});

describe('canUseTool', () => {
  it('el superadmin siempre puede', () => {
    expect(canUseTool(pm, policies[1], { isSuperadmin: true })).toBe(true); // DORA aunque sea product
  });
  it('un engineer ve DORA; un PM no (salvo grant explícito)', () => {
    expect(canUseTool(engineer, policies[1])).toBe(true);
    expect(canUseTool(pm, policies[1])).toBe(false);
  });
  it('todos ven Marea (everyone)', () => {
    expect(canUseTool(cpeople, policies[0])).toBe(true);
  });
});

describe('canManageTool', () => {
  it('People gestiona Encuestas; un engineer no', () => {
    expect(canManageTool(cpeople, policies[2])).toBe(true);
    expect(canManageTool(engineer, policies[2])).toBe(false);
  });
  it('el superadmin gestiona todo', () => {
    expect(canManageTool(engineer, policies[2], { isSuperadmin: true })).toBe(true);
  });
  it('ver no implica gestionar (Marea la ve todo el mundo pero no la gestiona)', () => {
    expect(canUseTool(engineer, policies[0])).toBe(true);
    expect(canManageTool(engineer, policies[0])).toBe(false);
  });
});

describe('visibleToolIds', () => {
  it('lista lo que la persona puede ver', () => {
    expect(visibleToolIds(engineer, policies).sort()).toEqual(['dora', 'marea', 'surveys']);
    expect(visibleToolIds(pm, policies).sort()).toEqual(['marea', 'surveys']);
  });
  it('el superadmin ve todas', () => {
    expect(visibleToolIds(pm, policies, { isSuperadmin: true }).sort()).toEqual(['dora', 'marea', 'surveys']);
  });
});
