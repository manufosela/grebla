import { describe, it, expect } from 'vitest';
import { fillAnswersFromRole } from './roleTemplate.js';

const items = [
  { id: 'gate', type: 'checkbox', weights: { em: 2, engineer: 0 } },
  { id: 'lead', type: 'scale', weights: { em: 2, engineer: 0 } },
  { id: 'mid', type: 'scale', weights: { em: 1, engineer: 1 } },
  // multi con peso para algunos roles y sin peso para 'staff'
  {
    id: 'multi',
    type: 'multi',
    options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'na', label: 'No procede' }],
    weights: { em: 1, engineer: 1, staff: 0 },
  },
];

describe('fillAnswersFromRole (modo inverso)', () => {
  it('mapea escala: peso 2 → 5, peso 1 → 3, peso 0 → 1', () => {
    const em = fillAnswersFromRole('em', items);
    expect(em.lead).toBe(5); // peso 2
    expect(em.mid).toBe(3); // peso 1
    const eng = fillAnswersFromRole('engineer', items);
    expect(eng.lead).toBe(1); // peso 0
    expect(eng.mid).toBe(3); // peso 1
  });

  it('mapea checkbox/gate: peso ≥1 → true, 0 → false', () => {
    expect(fillAnswersFromRole('em', items).gate).toBe(true);
    expect(fillAnswersFromRole('engineer', items).gate).toBe(false);
  });

  it('rellena selección múltiple: opción real si peso>0', () => {
    // sin mapeo específico para id 'multi' → primera opción real ('a')
    expect(fillAnswersFromRole('em', items).multi).toEqual(['a']);
    expect(fillAnswersFromRole('engineer', items).multi).toEqual(['a']);
  });

  it('selección múltiple sin peso para el rol → "No procede"', () => {
    expect(fillAnswersFromRole('staff', items).multi).toEqual(['na']);
  });

  it('es robusto ante entradas inválidas', () => {
    expect(fillAnswersFromRole('', items)).toEqual({});
    expect(fillAnswersFromRole('em', null)).toEqual({});
  });
});
