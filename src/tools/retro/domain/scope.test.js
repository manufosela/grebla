/**
 * Tests del ámbito de una retro (RMR-TSK-0498).
 *
 * Lo que se defiende: que cambiar el vocabulario no borre el pasado. Una retro
 * convocada cuando existían los squads sigue diciendo de qué squad fue, aunque
 * hoy ese catálogo ya no se use.
 */
import { describe, it, expect } from 'vitest';
import { scopeFromForm, scopeLabel, needsDomain, RETRO_SCOPES } from './scope.js';

const DOMINIOS = [{ key: 'tribbu-app', name: 'TRIBBU-APP' }, { key: 'plataforma', name: 'Plataforma' }];

describe('los ámbitos que se ofrecen', () => {
  it('son el equipo y el dominio; el squad ya no se puede elegir', () => {
    expect(RETRO_SCOPES.map((s) => s.id)).toEqual(['team', 'domain']);
  });
});

describe('scopeFromForm', () => {
  it('guarda el dominio por su clave, y también su nombre', () => {
    // El nombre se guarda para que la retro siga diciendo de quién fue aunque
    // el dominio se renombre o desaparezca del catálogo.
    expect(scopeFromForm({ scopeType: 'domain', domainKey: 'tribbu-app', label: 'TRIBBU-APP' }))
      .toEqual({ type: 'domain', domainKey: 'tribbu-app', label: 'TRIBBU-APP' });
  });

  it('el ámbito de equipo no arrastra clave ninguna', () => {
    expect(scopeFromForm({ scopeType: 'team' })).toEqual({ type: 'team', domainKey: null, label: null });
  });

  it('lo que no sea dominio es equipo, sin inventar un tercer estado', () => {
    expect(scopeFromForm({ scopeType: 'squad', domainKey: 'x' }).type).toBe('team');
    expect(scopeFromForm().type).toBe('team');
  });
});

describe('scopeLabel', () => {
  it('el dominio se rotula con su nombre de HOY', () => {
    const r = { scope: { type: 'domain', domainKey: 'tribbu-app', label: 'nombre viejo' } };
    expect(scopeLabel(r, DOMINIOS)).toBe('Dominio · TRIBBU-APP');
  });

  it('si el dominio ya no está en el catálogo, queda el nombre que se guardó', () => {
    const r = { scope: { type: 'domain', domainKey: 'retirado', label: 'Antiguo' } };
    expect(scopeLabel(r, DOMINIOS)).toBe('Dominio · Antiguo');
  });

  it('una retro de cuando había squads SIGUE diciendo de qué squad fue', () => {
    // Reescribirle el ámbito sería cambiar el pasado para que encaje con el
    // modelo de hoy.
    const r = { scope: { type: 'squad', squadId: 's1', label: 'Pagos' } };
    expect(scopeLabel(r, DOMINIOS)).toBe('Squad · Pagos');
  });

  it('sin ámbito guardado, es del equipo', () => {
    expect(scopeLabel({}, DOMINIOS)).toBe('Equipo');
    expect(scopeLabel({ scope: { type: 'team' } })).toBe('Equipo');
  });

  it('no revienta sin catálogo', () => {
    expect(scopeLabel({ scope: { type: 'domain', domainKey: 'x', label: 'Y' } })).toBe('Dominio · Y');
  });
});

describe('needsDomain', () => {
  it('una retro de dominio sin dominio no se puede convocar', () => {
    expect(needsDomain({ scopeType: 'domain' })).toBe(true);
    expect(needsDomain({ scopeType: 'domain', domainKey: '' })).toBe(true);
  });

  it('con dominio elegido, o siendo de equipo, adelante', () => {
    expect(needsDomain({ scopeType: 'domain', domainKey: 'tribbu-app' })).toBe(false);
    expect(needsDomain({ scopeType: 'team' })).toBe(false);
  });
});
