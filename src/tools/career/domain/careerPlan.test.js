import { describe, it, expect } from 'vitest';
import { normalizePlan, MAX_PLAN_ITEMS, MAX_PLAN_TEXT } from './careerPlan.js';

describe('normalizePlan: el plan de la persona (foco, responsabilidades, lo que suelta)', () => {
  it('sin documento, un plan vacío', () => {
    expect(normalizePlan(null)).toEqual({ focus: '', responsibilities: [], lettingGo: [] });
  });

  it('recorta textos y quita líneas vacías', () => {
    expect(normalizePlan({ focus: '  Llevar backend al 4 de diciembre ', responsibilities: [' Ownership de backend ', '  '], lettingGo: ['Postmortems'] }))
      .toEqual({ focus: 'Llevar backend al 4 de diciembre', responsibilities: ['Ownership de backend'], lettingGo: ['Postmortems'] });
  });

  it('descarta lo que no es texto y pone topes', () => {
    const many = Array.from({ length: MAX_PLAN_ITEMS + 3 }, (_, i) => `R${i}`);
    const plan = normalizePlan({ focus: 'a'.repeat(MAX_PLAN_TEXT + 10), responsibilities: [...many, 42, {}], lettingGo: 'no es lista' });
    expect(plan.focus).toHaveLength(MAX_PLAN_TEXT);
    expect(plan.responsibilities).toHaveLength(MAX_PLAN_ITEMS);
    expect(plan.lettingGo).toEqual([]);
  });
});
