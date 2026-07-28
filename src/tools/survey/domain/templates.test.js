import { describe, it, expect } from 'vitest';
import { climateTemplate, serializeTemplate, parseTemplate } from './templates.js';
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

describe('serializeTemplate / parseTemplate', () => {
  it('un round-trip conserva título y preguntas', () => {
    const tpl = { title: 'Clima', questions: climateTemplate() };
    const parsed = parseTemplate(serializeTemplate(tpl));
    expect(parsed.title).toBe('Clima');
    expect(parsed.questions).toEqual(tpl.questions);
  });

  it('acepta un array de preguntas directo (sin envoltorio)', () => {
    const parsed = parseTemplate(JSON.stringify([{ type: 'scale', min: 1, max: 5, label: 'q' }]));
    expect(parsed.title).toBe('');
    expect(parsed.questions).toHaveLength(1);
  });

  it('descarta campos desconocidos y preserva el id si viene', () => {
    const parsed = parseTemplate(JSON.stringify({
      questions: [{ id: 'x1', type: 'text', label: 'hola', maligno: 'drop', required: true }],
    }));
    expect(parsed.questions[0]).toEqual({ id: 'x1', type: 'text', label: 'hola', required: true });
  });

  it('en escala sin min/max cae a 1–5', () => {
    const [q] = parseTemplate(JSON.stringify([{ type: 'scale', label: 'q' }])).questions;
    expect(q).toMatchObject({ min: 1, max: 5 });
  });

  it('rechaza JSON inválido, sin preguntas o con tipo no soportado', () => {
    expect(() => parseTemplate('{no json')).toThrow(/JSON/);
    expect(() => parseTemplate('{"questions": []}')).toThrow(/pregunta/i);
    expect(() => parseTemplate(JSON.stringify([{ type: 'radio', label: 'q' }]))).toThrow(/tipo/i);
  });

  it('rechaza una escala inválida (min ≥ max)', () => {
    expect(() => parseTemplate(JSON.stringify([{ type: 'scale', min: 5, max: 5, label: 'q' }]))).toThrow();
  });
});
