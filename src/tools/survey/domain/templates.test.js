import { describe, it, expect } from 'vitest';
import { climateTemplate, serializeTemplate, parseTemplate, parseQuestionsCsv } from './templates.js';
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

  it('preserva las opciones de una pregunta de opción única', () => {
    const [q] = parseTemplate(JSON.stringify([
      { id: 'area', type: 'choice', label: '¿Área?', options: ['Producto', ' Ventas ', ''] },
    ])).questions;
    expect(q).toEqual({ id: 'area', type: 'choice', label: '¿Área?', required: false, options: ['Producto', 'Ventas'] });
  });

  it('en escala sin min/max cae a 1–5', () => {
    const [q] = parseTemplate(JSON.stringify([{ type: 'scale', label: 'q' }])).questions;
    expect(q).toMatchObject({ min: 1, max: 5 });
  });

  it('preserva next y reglas de salto válidas', () => {
    const parsed = parseTemplate(JSON.stringify({
      questions: [
        { id: 'a', type: 'choice', label: '¿Área?', options: ['Ventas', 'Otro'], rules: [{ equals: 'Ventas', goto: 'c' }], next: 'b' },
        { id: 'b', type: 'text', label: 'b' },
        { id: 'c', type: 'text', label: 'c' },
      ],
    }));
    expect(parsed.questions[0].next).toBe('b');
    expect(parsed.questions[0].rules).toEqual([{ equals: 'Ventas', goto: 'c' }]);
  });

  it('rechaza un flujo con destino inexistente o cíclico', () => {
    expect(() => parseTemplate(JSON.stringify([{ id: 'a', type: 'text', label: 'a', next: 'zzz' }]))).toThrow();
    expect(() => parseTemplate(JSON.stringify([{ id: 'a', type: 'text', label: 'a', next: 'a' }]))).toThrow();
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

describe('parseQuestionsCsv', () => {
  it('con cabecera mapea por nombre y aplica escala por defecto si faltan min/max', () => {
    const csv = [
      'tipo,enunciado,min,max,obligatoria,opciones',
      'scale,¿Recomendarías?,1,10,si,',
      'text,¿Por qué?,,,no,',
      'scale,Otra de escala,,,si,',
    ].join('\n');
    const qs = parseQuestionsCsv(csv, { min: 1, max: 5 });
    expect(qs).toEqual([
      { type: 'scale', label: '¿Recomendarías?', required: true, min: 1, max: 10 },
      { type: 'text', label: '¿Por qué?', required: false },
      { type: 'scale', label: 'Otra de escala', required: true, min: 1, max: 5 },
    ]);
  });

  it('parte las opciones de una choice por | ', () => {
    const [q] = parseQuestionsCsv('choice,¿Área?,,,si,Producto|Ventas|Soporte');
    expect(q).toEqual({ type: 'choice', label: '¿Área?', required: true, options: ['Producto', 'Ventas', 'Soporte'] });
  });

  it('respeta las comas dentro de comillas y las comillas escapadas', () => {
    const csv = ['tipo,enunciado,min,max,obligatoria,opciones', 'scale,"¿Recomendarías TRIBBU, de ""verdad""?",1,5,si,'].join('\n');
    const [q] = parseQuestionsCsv(csv);
    expect(q.label).toBe('¿Recomendarías TRIBBU, de "verdad"?');
    expect(q).toMatchObject({ type: 'scale', min: 1, max: 5 });
  });

  it('sin cabecera usa el orden posicional', () => {
    const [q] = parseQuestionsCsv('scale,Enunciado,1,7,si,');
    expect(q).toMatchObject({ type: 'scale', min: 1, max: 7, required: true });
  });

  it('detecta la cabecera aunque las columnas vayan en otro orden', () => {
    const csv = ['enunciado,obligatoria,tipo,opciones,min,max', '¿Área?,si,choice,A|B,,'].join('\n');
    expect(parseQuestionsCsv(csv)).toEqual([
      { type: 'choice', label: '¿Área?', required: true, options: ['A', 'B'] },
    ]);
  });

  it('rechaza tipo no soportado, choice con menos de dos opciones y CSV vacío', () => {
    expect(() => parseQuestionsCsv('radio,q,,,,')).toThrow(/tipo/i);
    expect(() => parseQuestionsCsv('choice,q,,,si,solo-una')).toThrow(/opciones/i);
    expect(() => parseQuestionsCsv('   ')).toThrow(/vac/i);
  });
});
