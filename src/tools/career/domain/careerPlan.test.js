import { describe, it, expect } from 'vitest';
import { normalizePlan, planGroups, MAX_PLAN_ITEMS, MAX_PLAN_TEXT } from './careerPlan.js';

describe('normalizePlan: el plan de la persona (foco, de qué se encarga, lo que se espera, lo que no es su foco)', () => {
  it('sin documento, un plan vacío', () => {
    expect(normalizePlan(null)).toEqual({ focus: '', responsibilities: [], expectations: [], lettingGo: [] });
  });

  it('recorta textos y quita líneas vacías', () => {
    expect(normalizePlan({ focus: '  Llevar backend al 4 de diciembre ', responsibilities: [' Ownership de backend ', '  '], expectations: [' Criterio técnico '], lettingGo: ['Postmortems'] }))
      .toEqual({ focus: 'Llevar backend al 4 de diciembre', responsibilities: ['Ownership de backend'], expectations: ['Criterio técnico'], lettingGo: ['Postmortems'] });
  });

  it('quita el guion de lista que se escriba al principio de una línea', () => {
    expect(normalizePlan({ responsibilities: ['- Delegar', '-Escalar a tiempo', 'Sin guion'] }).responsibilities)
      .toEqual(['Delegar', 'Escalar a tiempo', 'Sin guion']);
  });

  it('descarta lo que no es texto y pone topes', () => {
    const many = Array.from({ length: MAX_PLAN_ITEMS + 3 }, (_, i) => `R${i}`);
    const plan = normalizePlan({ focus: 'a'.repeat(MAX_PLAN_TEXT + 10), responsibilities: [...many, 42, {}], lettingGo: 'no es lista' });
    expect(plan.focus).toHaveLength(MAX_PLAN_TEXT);
    expect(plan.responsibilities).toHaveLength(MAX_PLAN_ITEMS);
    expect(plan.lettingGo).toEqual([]);
  });
});

describe('planGroups: una línea que acaba en dos puntos abre un apartado', () => {
  it('agrupa las líneas bajo su apartado; las de antes van sin título', () => {
    expect(planGroups(['Delegar', 'Seguimiento:', 'Cada semana', 'Pendientes:', 'Lista de tareas']))
      .toEqual([{ title: '', items: ['Delegar'] }, { title: 'Seguimiento', items: ['Cada semana'] }, { title: 'Pendientes', items: ['Lista de tareas'] }]);
  });

  it('sin apartados, un único grupo; un apartado vacío no se pinta', () => {
    expect(planGroups(['A', 'B'])).toEqual([{ title: '', items: ['A', 'B'] }]);
    expect(planGroups(['Vacío:', 'Lleno:', 'X'])).toEqual([{ title: 'Lleno', items: ['X'] }]);
  });
});
