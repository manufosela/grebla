/** Tests de la lógica pura de acciones de retro (RMR-TSK-0246). */
import { describe, it, expect } from 'vitest';
import { ownersText, canToggle, sameScope } from './actionView.js';

const members = [{ uid: 'ana', name: 'Ana P.' }, { uid: 'beto', name: 'Beto R.' }];

describe('ownersText', () => {
  it('resuelve owners a nombres', () => {
    expect(ownersText({ owners: ['ana', 'beto'] }, members)).toBe('Ana P., Beto R.');
  });
  it('sin owners → «Sin owner»', () => {
    expect(ownersText({ owners: [] }, members)).toBe('Sin owner');
    expect(ownersText({}, members)).toBe('Sin owner');
  });
});

describe('canToggle', () => {
  it('el líder siempre puede', () => {
    expect(canToggle({ owners: ['ana'] }, 'leader', 'leader')).toBe(true);
  });
  it('un owner puede la suya', () => {
    expect(canToggle({ owners: ['ana'] }, 'ana', 'leader')).toBe(true);
  });
  it('quien no es owner ni líder, no', () => {
    expect(canToggle({ owners: ['ana'] }, 'beto', 'leader')).toBe(false);
    expect(canToggle({ owners: ['ana'] }, null, 'leader')).toBe(false);
  });
});

describe('sameScope', () => {
  it('equipo con equipo', () => {
    expect(sameScope({ scope: { type: 'team' } }, { type: 'team' })).toBe(true);
  });
  it('squad solo si coincide el label', () => {
    expect(sameScope({ scope: { type: 'squad', label: 'Pagos' } }, { type: 'squad', label: 'Pagos' })).toBe(true);
    expect(sameScope({ scope: { type: 'squad', label: 'Pagos' } }, { type: 'squad', label: 'Otro' })).toBe(false);
  });
  it('tipos distintos no coinciden', () => {
    expect(sameScope({ scope: { type: 'team' } }, { type: 'squad', label: 'Pagos' })).toBe(false);
  });
});
