import { describe, it, expect } from 'vitest';
import { matchesGrant, canUseTool, canManageTool, visibleToolIds, effectiveToolAccess } from './toolAccess.js';

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

describe('overrides por persona', () => {
  const marea = policies[0]; // everyone
  const dora = policies[1]; // branch engineering

  it('un override use:false niega Marea a un engineer que la vería por defecto', () => {
    const nuevo = { ...engineer, toolOverrides: { marea: { use: false } } };
    expect(canUseTool(engineer, marea)).toBe(true);
    expect(canUseTool(nuevo, marea)).toBe(false); // el override manda
  });

  it('un override use:true concede una herramienta que el rol no daría (PM ve DORA puntualmente)', () => {
    const pmConDora = { ...pm, toolOverrides: { dora: { use: true } } };
    expect(canUseTool(pm, dora)).toBe(false);
    expect(canUseTool(pmConDora, dora)).toBe(true);
  });

  it('el override de manage es independiente del de use', () => {
    const p = { ...engineer, toolOverrides: { dora: { manage: true } } };
    expect(canManageTool(p, dora)).toBe(true); // override concede gestión
    expect(canUseTool(p, dora)).toBe(true);    // use sigue por el rol (engineering)
  });

  it('el superadmin ignora los overrides (siempre puede)', () => {
    const bloqueado = { ...engineer, toolOverrides: { marea: { use: false } } };
    expect(canUseTool(bloqueado, marea, { isSuperadmin: true })).toBe(true);
  });
});

describe('effectiveToolAccess (origen de cada decisión)', () => {
  it('marca «role» cuando el acceso viene del rol', () => {
    const eff = effectiveToolAccess(engineer, policies[1]);
    expect(eff.use).toEqual({ value: true, source: 'role' });
    expect(eff.manage).toEqual({ value: false, source: 'role' });
  });
  it('marca «override» cuando hay excepción individual', () => {
    const p = { ...engineer, toolOverrides: { dora: { use: false } } };
    expect(effectiveToolAccess(p, policies[1]).use).toEqual({ value: false, source: 'override' });
  });
  it('marca «superadmin» cuando manda el gobierno', () => {
    const eff = effectiveToolAccess(pm, policies[1], { isSuperadmin: true });
    expect(eff.use).toEqual({ value: true, source: 'superadmin' });
  });
});
