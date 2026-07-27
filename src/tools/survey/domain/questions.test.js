import { describe, it, expect } from 'vitest';
import { scaleRange, validateAnswer, validateResponses } from './questions.js';

const enps = { id: 'enps', type: 'scale', min: 1, max: 10, required: true };
const q12a = { id: 'q1', type: 'scale', min: 1, max: 5, required: true };
const reason = { id: 'reason', type: 'text' };

describe('scaleRange', () => {
  it('usa el min/max de la pregunta', () => {
    expect(scaleRange(enps)).toEqual({ min: 1, max: 10 });
  });
  it('cae a 1–5 por defecto si no se fijan', () => {
    expect(scaleRange({ type: 'scale' })).toEqual({ min: 1, max: 5 });
  });
});

describe('validateAnswer', () => {
  it('acepta un entero dentro del rango de la escala', () => {
    expect(validateAnswer(enps, 10)).toBe(true);
    expect(validateAnswer(q12a, 3)).toBe(true);
  });
  it('rechaza fuera de rango, no enteros y tipos erróneos', () => {
    expect(validateAnswer(enps, 11)).toBe(false);
    expect(validateAnswer(enps, 0)).toBe(false);
    expect(validateAnswer(q12a, 2.5)).toBe(false);
    expect(validateAnswer(q12a, '4')).toBe(false);
  });
  it('el texto acepta cualquier string (incluido vacío)', () => {
    expect(validateAnswer(reason, 'porque sí')).toBe(true);
    expect(validateAnswer(reason, '')).toBe(true);
    expect(validateAnswer(reason, 5)).toBe(false);
  });
});

describe('validateResponses', () => {
  const questions = [enps, q12a, reason];

  it('es válido con todas las obligatorias respondidas', () => {
    expect(validateResponses(questions, { enps: 9, q1: 4, reason: 'ok' })).toEqual({ valid: true, errors: [] });
  });
  it('el texto no obligatorio puede faltar', () => {
    expect(validateResponses(questions, { enps: 9, q1: 4 }).valid).toBe(true);
  });
  it('marca las obligatorias que faltan', () => {
    const r = validateResponses(questions, { enps: 9 });
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual({ id: 'q1', error: 'required' });
  });
  it('marca las respondidas fuera de rango', () => {
    const r = validateResponses(questions, { enps: 99, q1: 4 });
    expect(r.errors).toContainEqual({ id: 'enps', error: 'invalid' });
  });
});
