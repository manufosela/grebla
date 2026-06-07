import { describe, it, expect } from 'vitest';
import { fillAnswersFromRole } from './roleTemplate.js';

const items = [
  { id: 'gate', type: 'checkbox', weights: { em: 2, engineer: 0 } },
  { id: 'lead', type: 'scale', weights: { em: 2, engineer: 0 } },
  { id: 'mid', type: 'scale', weights: { em: 1, engineer: 1 } },
  { id: 'multi', type: 'multi', options: [{ value: 'a', label: 'A' }], weights: { em: 1, engineer: 1 } },
];

describe('fillAnswersFromRole (modo inverso)', () => {
  it('mapea escala: peso 2→5, 1→3, 0→1', () => {
    const em = fillAnswersFromRole('em', items);
    expect(em.lead).toBe(5);
    expect(em.mid).toBe(3);
    const eng = fillAnswersFromRole('engineer', items);
    expect(eng.lead).toBe(1);
    expect(eng.mid).toBe(3);
  });

  it('mapea checkbox/gate: peso ≥1 → true, 0 → false', () => {
    expect(fillAnswersFromRole('em', items).gate).toBe(true);
    expect(fillAnswersFromRole('engineer', items).gate).toBe(false);
  });

  it('no marca selección múltiple (sin mapeo por peso)', () => {
    expect(fillAnswersFromRole('em', items)).not.toHaveProperty('multi');
  });

  it('es robusto ante entradas inválidas', () => {
    expect(fillAnswersFromRole('', items)).toEqual({});
    expect(fillAnswersFromRole('em', null)).toEqual({});
  });
});
