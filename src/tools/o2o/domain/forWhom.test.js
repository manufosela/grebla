import { describe, it, expect } from 'vitest';
import { forWhomView, defaultForWhom, chosenIds, togglePerson } from './forWhom.js';

const people = [
  { id: 'ana', name: 'Ana', uid: 'u-ana', directoryManagerUids: ['u-me'] },
  { id: 'bea', name: 'Bea', uid: 'u-bea', directoryManagerUids: ['u-me'] },
  { id: 'carlos', name: 'Carlos', directoryManagerUids: ['u-bea', 'u-me'] },
  { id: 'dani', name: 'Dani', directoryManagerUids: ['u-otro', 'u-me'] },
];

describe('forWhomView: la rama de quien hace el O2O (RMR-TSK-0664)', () => {
  it('separa directos del resto, y al resto le pone de quién depende', () => {
    expect(forWhomView(people, 'u-me')).toEqual({
      directs: [{ id: 'ana', name: 'Ana' }, { id: 'bea', name: 'Bea' }],
      rest: [{ id: 'carlos', name: 'Carlos', bossName: 'Bea' }, { id: 'dani', name: 'Dani', bossName: null }],
    });
  });
});

describe('defaultForWhom y chosenIds', () => {
  it('un O2O nuevo empieza con los directos marcados', () => {
    expect(defaultForWhom(people, 'u-me')).toEqual(['ana', 'bea']);
  });

  it('manda lo marcado en el O2O; uno anterior a «Para quién» empieza con los directos', () => {
    expect(chosenIds({ personIds: ['carlos'] }, people, 'u-me')).toEqual(['carlos']);
    expect(chosenIds({ personIds: [] }, people, 'u-me')).toEqual([]);
    expect(chosenIds({}, people, 'u-me')).toEqual(['ana', 'bea']);
  });
});

describe('togglePerson', () => {
  it('marca y desmarca sin repetir', () => {
    expect(togglePerson(['ana'], 'bea')).toEqual(['ana', 'bea']);
    expect(togglePerson(['ana', 'bea'], 'ana')).toEqual(['bea']);
  });
});
