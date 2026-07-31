import { describe, it, expect } from 'vitest';
import { unitDisplayName, unitNamesByKind, withCurrentOption, withCurrentOptions } from './leanUnits.js';

describe('unitDisplayName', () => {
  it('usa name cuando existe (trim)', () => {
    expect(unitDisplayName({ name: '  Trust  ', linearLabel: 'trust-label' })).toBe('Trust');
  });

  it('cae a linearLabel cuando falta name', () => {
    expect(unitDisplayName({ name: '   ', linearLabel: 'Backend' })).toBe('Backend');
    expect(unitDisplayName({ linearLabel: 'Data' })).toBe('Data');
  });

  it('devuelve cadena vacía si no hay ni name ni linearLabel', () => {
    expect(unitDisplayName({})).toBe('');
    expect(unitDisplayName(null)).toBe('');
  });
});

describe('unitNamesByKind', () => {
  it('separa squads y chapters por nombre visible, dedup y ordenado', () => {
    const units = [
      { kind: 'squad', name: 'Trust', linearLabel: 'trust' },
      { kind: 'chapter', name: 'Backend', linearLabel: 'be' },
      { kind: 'squad', linearLabel: 'Growth' },
      { kind: 'squad', name: 'Trust', linearLabel: 'dup' },
      { kind: 'chapter', name: 'Frontend', linearLabel: 'fe' },
    ];
    expect(unitNamesByKind(units)).toEqual({
      squads: ['Growth', 'Trust'],
      chapters: ['Backend', 'Frontend'],
    });
  });

  it('descarta unidades sin nombre y tolera entradas no-array', () => {
    expect(unitNamesByKind([{ kind: 'squad' }, { kind: 'chapter', name: '  ' }])).toEqual({
      squads: [],
      chapters: [],
    });
    expect(unitNamesByKind(null)).toEqual({ squads: [], chapters: [] });
  });
});

describe('withCurrentOption', () => {
  it('incluye el valor actual aunque no esté en el catálogo (compat texto libre)', () => {
    expect(withCurrentOption(['Growth', 'Trust'], 'Legacy')).toEqual(['Growth', 'Legacy', 'Trust']);
  });

  it('no duplica si ya está y respeta vacío/espacios', () => {
    expect(withCurrentOption(['Growth', 'Trust'], 'Trust')).toEqual(['Growth', 'Trust']);
    expect(withCurrentOption(['Growth'], '  ')).toEqual(['Growth']);
    expect(withCurrentOption(['Growth'], null)).toEqual(['Growth']);
  });
});

describe('withCurrentOptions', () => {
  it('añade los valores actuales que no estén en el catálogo, sin duplicar', () => {
    expect(withCurrentOptions(['Backend', 'Frontend'], ['Frontend', 'Legacy'])).toEqual([
      'Backend',
      'Frontend',
      'Legacy',
    ]);
  });

  it('devuelve el catálogo intacto si no hay extras y tolera no-array', () => {
    expect(withCurrentOptions(['Backend'], [])).toEqual(['Backend']);
    expect(withCurrentOptions(['Backend'], null)).toEqual(['Backend']);
    expect(withCurrentOptions(['Backend'], ['  ', 'Backend'])).toEqual(['Backend']);
  });
});
