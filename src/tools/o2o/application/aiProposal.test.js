import { describe, it, expect } from 'vitest';
import { sanitizeProposal, periodQuestions, sanitizePrep, periodPrep } from './aiProposal.js';

describe('sanitizeProposal', () => {
  it('normaliza grupos y preguntas, admite preguntas como string u objeto', () => {
    const p = sanitizeProposal({
      intro: '  Piensa en tu   trimestre  ',
      groups: [
        { title: 'Carrera', questions: [{ text: '¿Qué te ilusiona?' }, '¿Qué te frena?'] },
      ],
    });
    expect(p.intro).toBe('Piensa en tu trimestre');
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0]).toEqual({
      title: 'Carrera',
      questions: [{ text: '¿Qué te ilusiona?' }, { text: '¿Qué te frena?' }],
    });
  });

  it('descarta grupos vacíos y preguntas en blanco', () => {
    const p = sanitizeProposal({
      groups: [
        { title: '', questions: [] },
        { title: 'Bienestar', questions: ['', '  ', 'Válida'] },
      ],
    });
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0].title).toBe('Bienestar');
    expect(p.groups[0].questions).toEqual([{ text: 'Válida' }]);
  });

  it('tolera basura sin lanzar', () => {
    expect(sanitizeProposal(null)).toEqual({ intro: '', groups: [] });
    expect(sanitizeProposal('nope')).toEqual({ intro: '', groups: [] });
    expect(sanitizeProposal({ groups: 'x' }).groups).toEqual([]);
  });

  it('aplica topes de tamaño', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `G${i}`, questions: ['q'] }));
    expect(sanitizeProposal({ groups: many }).groups.length).toBeLessThanOrEqual(12);
    const longText = 'x'.repeat(1000);
    expect(sanitizeProposal({ groups: [{ title: longText, questions: [] }] }).groups[0].title.length).toBe(400);
  });
});

describe('periodQuestions', () => {
  it('extrae los bloques de la guía', () => {
    const period = {
      name: 'Periodo Julio',
      guide: { blocks: [{ title: 'A', questions: [{ text: 'q1' }, { text: '' }] }, { title: 'B', questions: [] }] },
    };
    const out = periodQuestions(period, 'guide');
    expect(out.name).toBe('Periodo Julio');
    expect(out.groups).toEqual([{ title: 'A', questions: ['q1'] }]);
  });

  it('extrae las secciones del formulario', () => {
    const period = { name: 'P', form: { sections: [{ title: 'S', questions: [{ text: 'f1' }] }] } };
    expect(periodQuestions(period, 'form').groups).toEqual([{ title: 'S', questions: ['f1'] }]);
  });

  it('periodo sin contenido → grupos vacíos', () => {
    expect(periodQuestions({ name: 'X' }, 'guide').groups).toEqual([]);
  });
});

describe('sanitizePrep', () => {
  it('normaliza guía y formulario a la vez', () => {
    const out = sanitizePrep({
      guide: { groups: [{ title: 'Durante', questions: ['¿Cómo vas?'] }] },
      form: { intro: 'Piensa antes', groups: [{ title: 'Antes', questions: [{ text: '¿Qué traes?' }] }] },
    });
    expect(out.guide.groups[0]).toEqual({ title: 'Durante', questions: [{ text: '¿Cómo vas?' }] });
    expect(out.form.intro).toBe('Piensa antes');
    expect(out.form.groups[0].questions).toEqual([{ text: '¿Qué traes?' }]);
  });

  it('tolera basura: ambas baterías vacías sin lanzar', () => {
    expect(sanitizePrep(null)).toEqual({ guide: { intro: '', groups: [] }, form: { intro: '', groups: [] } });
    expect(sanitizePrep({ guide: 'x' }).guide.groups).toEqual([]);
  });
});

describe('periodPrep', () => {
  it('extrae guía y formulario del periodo para el contexto de la IA', () => {
    const period = {
      name: 'Periodo Julio',
      guide: { blocks: [{ title: 'G', questions: [{ text: 'g1' }] }] },
      form: { sections: [{ title: 'F', questions: [{ text: 'f1' }] }] },
    };
    expect(periodPrep(period)).toEqual({
      name: 'Periodo Julio',
      guide: [{ title: 'G', questions: ['g1'] }],
      form: [{ title: 'F', questions: ['f1'] }],
    });
  });
});
