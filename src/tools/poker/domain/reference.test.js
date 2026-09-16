import { describe, it, expect } from 'vitest';
import { normalizeLinearRef } from './reference.js';

describe('normalizeLinearRef', () => {
  it('pone en mayúsculas y quita espacios: lo que se escribe a mano', () => {
    expect(normalizeLinearRef(' bb-1234 ')).toBe('BB-1234');
    expect(normalizeLinearRef('ENG-7')).toBe('ENG-7');
  });

  it('vacío es «sin referencia», no un error', () => {
    expect(normalizeLinearRef('')).toBe('');
    expect(normalizeLinearRef('   ')).toBe('');
    expect(normalizeLinearRef(null)).toBe('');
  });

  it('lo que no es un identificador es null: no se manda a Linear', () => {
    for (const mal of ['1234', 'BB1234', 'https://linear.app/tribbu/issue/BB-1234', 'BB-', 'B-1']) {
      expect(normalizeLinearRef(mal)).toBeNull();
    }
  });
});
