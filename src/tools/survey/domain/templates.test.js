import { describe, it, expect } from 'vitest';
import { climateTemplate } from './templates.js';
import { validateAnswer } from './questions.js';

describe('climateTemplate', () => {
  const questions = climateTemplate();

  it('tiene el eNPS (1–10), su razón en texto y las 12 del Q12 (1–5) = 14 preguntas', () => {
    expect(questions).toHaveLength(14);
    expect(questions[0]).toMatchObject({ id: 'enps', type: 'scale', min: 1, max: 10, required: true });
    expect(questions[1]).toMatchObject({ id: 'enps_reason', type: 'text' });
    const q12 = questions.slice(2);
    expect(q12).toHaveLength(12);
    expect(q12.every((q) => q.type === 'scale' && q.min === 1 && q.max === 5)).toBe(true);
  });

  it('los ids son únicos y estables (enps, enps_reason, q1..q12)', () => {
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('q12');
  });

  it('sus preguntas validan respuestas coherentes con el dominio', () => {
    expect(validateAnswer(questions[0], 10)).toBe(true);
    expect(validateAnswer(questions[0], 11)).toBe(false);
    expect(validateAnswer(questions[2], 5)).toBe(true);
    expect(validateAnswer(questions[2], 6)).toBe(false);
  });
});
