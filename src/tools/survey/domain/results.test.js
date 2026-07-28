import { describe, it, expect } from 'vitest';
import { participationByDept, participationTotal, answerValues, textAnswers, scaleResult, segmentedScale } from './results.js';

const tokens = [
  { metadata: { department: 'People' }, used: true },
  { metadata: { department: 'People' }, used: false },
  { metadata: { department: 'Eng' }, used: true },
];

describe('participación', () => {
  it('por departamento (respondidos/total y %)', () => {
    expect(participationByDept(tokens)).toEqual([
      { department: 'Eng', total: 1, responded: 1, pct: 100 },
      { department: 'People', total: 2, responded: 1, pct: 50 },
    ]);
  });
  it('total global', () => {
    expect(participationTotal(tokens)).toEqual({ total: 3, responded: 2, pct: 67 });
  });
});

describe('valores y textos', () => {
  const answers = [
    { answers: { enps: 9, reason: 'bien' } },
    { answers: { enps: 3, reason: '' } },
    { answers: {} },
  ];
  it('answerValues descarta ausentes', () => {
    expect(answerValues(answers, 'enps')).toEqual([9, 3]);
  });
  it('textAnswers descarta vacíos', () => {
    expect(textAnswers(answers, 'reason')).toEqual(['bien']);
  });
});

describe('scaleResult', () => {
  it('calcula eNPS cuando la escala es 1..10', () => {
    const r = scaleResult({ min: 1, max: 10 }, [9, 10, 3]);
    expect(r.n).toBe(3);
    expect(r.enps).toBe(33); // 2 promotores, 1 detractor → (66.7 − 33.3) ≈ 33
  });
  it('no calcula eNPS en una escala 1..5 (Q12)', () => {
    expect(scaleResult({ min: 1, max: 5 }, [4, 5]).enps).toBeNull();
  });
});

describe('segmentedScale (k-anon)', () => {
  const question = { id: 'enps', min: 1, max: 10 };
  const answers = [
    { metadata: { department: 'Eng' }, answers: { enps: 8 } },
    { metadata: { department: 'Eng' }, answers: { enps: 9 } },
    { metadata: { department: 'People' }, answers: { enps: 10 } },
  ];
  it('oculta los segmentos con menos de N respuestas', () => {
    const { visible, suppressed } = segmentedScale(answers, question, 'department', 2);
    expect(visible.map((s) => s.key)).toEqual(['Eng']);
    expect(suppressed.map((s) => s.key)).toEqual(['People']);
  });
});
