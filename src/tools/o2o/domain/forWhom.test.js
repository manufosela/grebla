import { describe, it, expect } from 'vitest';
import { forWhomView, defaultForWhom, chosenIds, togglePerson, setAll } from './forWhom.js';

// Bea no tiene cuenta: Carlos depende de ella aunque su primer jefe con cuenta sea yo.
const people = [
  { id: 'ana', name: 'Ana', reportsToPersonId: 'me' },
  { id: 'bea', name: 'Bea', reportsToPersonId: 'me' },
  { id: 'carlos', name: 'Carlos', reportsToPersonId: 'bea' },
  { id: 'dani', name: 'Dani', reportsToPersonId: 'fuera-de-la-lista' },
];

describe('forWhomView: la rama de quien hace el O2O (RMR-TSK-0664)', () => {
  it('directos son los que dependen de mí en el directorio; al resto le pone de quién depende', () => {
    expect(forWhomView(people, 'me')).toEqual({
      directs: [{ id: 'ana', name: 'Ana' }, { id: 'bea', name: 'Bea' }],
      rest: [{ id: 'carlos', name: 'Carlos', bossName: 'Bea' }, { id: 'dani', name: 'Dani', bossName: null }],
    });
  });

  it('sin ficha propia no hay directos (RMR-TSK-0669)', () => {
    expect(forWhomView(people, null).directs).toEqual([]);
  });
});

describe('defaultForWhom y chosenIds', () => {
  it('un O2O nuevo empieza con los directos marcados', () => {
    expect(defaultForWhom(people, 'me')).toEqual(['ana', 'bea']);
  });

  it('manda lo marcado en el O2O; uno anterior a «Para quién» empieza con los directos', () => {
    expect(chosenIds({ personIds: ['carlos'] }, people, 'me')).toEqual(['carlos']);
    expect(chosenIds({ personIds: [] }, people, 'me')).toEqual([]);
    expect(chosenIds({}, people, 'me')).toEqual(['ana', 'bea']);
  });
});

describe('setAll (RMR-TSK-0669)', () => {
  it('marca a todos sin repetir y desmarca a todos', () => {
    expect(setAll(['ana'], ['ana', 'bea'], true)).toEqual(['ana', 'bea']);
    expect(setAll(['ana', 'carlos'], ['ana', 'bea'], false)).toEqual(['carlos']);
  });
});

describe('togglePerson', () => {
  it('marca y desmarca sin repetir', () => {
    expect(togglePerson(['ana'], 'bea')).toEqual(['ana', 'bea']);
    expect(togglePerson(['ana', 'bea'], 'ana')).toEqual(['bea']);
  });
});
