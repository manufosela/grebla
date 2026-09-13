/**
 * Tests de la propuesta de roles de contribución (RMR-TSK-0494).
 *
 * Lo que se defiende aquí, por encima de acertar: que la propuesta se pueda
 * DISCUTIR. Sale con el porqué —qué respuestas llevan a cada rol—, no propone
 * lo que no ha visto nadie, y no pretende cubrir los nueve roles porque el
 * formulario tenga nueve casillas.
 */
import { describe, it, expect } from 'vitest';
import { scoreBelbin, proposeRoles, evidenceFor } from './belbinSurvey.js';
import { BELBIN_ITEMS } from '../data/belbinItems.js';

/** Respuestas con todo a 0 salvo lo que se pase. */
const respuestas = (parciales) => Object.fromEntries(
  BELBIN_ITEMS.map((i) => [i.id, parciales[i.id] ?? 0]),
);

describe('scoreBelbin: cuánto puntúa cada rol', () => {
  it('suma lo respondido en los ítems de cada rol', () => {
    const s = scoreBelbin(respuestas({ 'pl-1': 2, 'pl-2': 1 }));
    expect(s.PL).toBe(3);
  });

  it('lo no respondido no puntúa, y no rompe', () => {
    expect(scoreBelbin({}).PL).toBe(0);
    expect(scoreBelbin(null).CF).toBe(0);
  });

  it('todos los roles aparecen, aunque sea con cero', () => {
    // Un rol ausente del resultado se leería como «no se preguntó», y sí se
    // preguntó: la respuesta fue que no se ha visto.
    const s = scoreBelbin(respuestas({}));
    expect(Object.keys(s).toSorted()).toEqual(['CF', 'CO', 'IMP', 'ME', 'PL', 'RI', 'SH', 'SP', 'TW'].toSorted());
  });

  it('ignora respuestas fuera de la escala en vez de dejarlas colar', () => {
    expect(scoreBelbin({ 'pl-1': 7 }).PL).toBe(0);
    expect(scoreBelbin({ 'pl-1': -1 }).PL).toBe(0);
  });
});

describe('proposeRoles: qué se propone', () => {
  it('lo más marcado va de primario', () => {
    const p = proposeRoles(respuestas({ 'sh-1': 2, 'sh-2': 2, 'cf-1': 1 }));
    expect(p.primary).toEqual(['SH']);
  });

  it('lo que se ha visto a medias va de secundario', () => {
    const p = proposeRoles(respuestas({ 'sh-1': 2, 'sh-2': 2, 'cf-1': 1, 'cf-2': 1 }));
    expect(p.primary).toEqual(['SH']);
    expect(p.secondary).toEqual(['CF']);
  });

  it('lo que NO se ha visto no se propone', () => {
    // Rellenar los nueve roles porque el formulario tiene nueve casillas es
    // inventarse la mitad del equipo.
    const p = proposeRoles(respuestas({ 'pl-1': 2, 'pl-2': 2 }));
    expect(p.primary).toEqual(['PL']);
    expect(p.secondary).toEqual([]);
  });

  it('sin respuestas no propone nada, en vez de repartir a ciegas', () => {
    expect(proposeRoles(respuestas({}))).toEqual({ primary: [], secondary: [] });
    expect(proposeRoles({})).toEqual({ primary: [], secondary: [] });
  });

  it('varios roles igual de marcados salen todos: quien decide es el manager', () => {
    const p = proposeRoles(respuestas({ 'sh-1': 2, 'sh-2': 2, 'co-1': 2, 'co-2': 2 }));
    expect(p.primary.toSorted()).toEqual(['CO', 'SH']);
  });

  it('el orden es por puntuación, para que lo más claro vaya primero', () => {
    const p = proposeRoles(respuestas({ 'sh-1': 2, 'sh-2': 2, 'co-1': 2, 'co-2': 1, 'tw-1': 1 }));
    expect(p.primary).toEqual(['SH', 'CO']);
  });
});

describe('evidenceFor: el porqué de cada propuesta', () => {
  it('devuelve las conductas que se marcaron para ese rol', () => {
    const ev = evidenceFor('SH', respuestas({ 'sh-1': 2, 'sh-2': 0 }));
    expect(ev).toHaveLength(1);
    expect(ev[0].text).toContain('Empuja para que se decida');
    expect(ev[0].value).toBe(2);
  });

  it('sin nada marcado no hay evidencia que enseñar', () => {
    expect(evidenceFor('SH', respuestas({}))).toEqual([]);
  });

  it('un rol que no existe no inventa evidencia', () => {
    expect(evidenceFor('XX', respuestas({ 'sh-1': 2 }))).toEqual([]);
  });
});
