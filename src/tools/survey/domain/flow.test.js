import { describe, it, expect } from 'vitest';
import { END, firstQuestionId, hasBranching, resolveNext, flowErrors } from './flow.js';

const linear = [
  { id: 'a', type: 'text' },
  { id: 'b', type: 'text' },
  { id: 'c', type: 'text' },
];

describe('firstQuestionId', () => {
  it('devuelve el id de la primera, o null si no hay', () => {
    expect(firstQuestionId(linear)).toBe('a');
    expect(firstQuestionId([])).toBeNull();
  });
});

describe('hasBranching', () => {
  it('es falso en un flujo lineal y verdadero con next o rules', () => {
    expect(hasBranching(linear)).toBe(false);
    expect(hasBranching([{ id: 'a', next: 'c' }, { id: 'c' }])).toBe(true);
    expect(hasBranching([{ id: 'a', rules: [{ equals: 'x', goto: 'c' }] }])).toBe(true);
  });
});

describe('resolveNext', () => {
  it('sin reglas ni next, va a la siguiente en orden', () => {
    expect(resolveNext(linear[0], undefined, linear)).toBe('b');
  });
  it('la última en orden termina', () => {
    expect(resolveNext(linear[2], undefined, linear)).toBe(END);
  });
  it('respeta next por defecto', () => {
    const qs = [{ id: 'a', next: 'c' }, { id: 'b' }, { id: 'c' }];
    expect(resolveNext(qs[0], undefined, qs)).toBe('c');
  });
  it('next a END termina aunque haya más preguntas', () => {
    const qs = [{ id: 'a', next: END }, { id: 'b' }];
    expect(resolveNext(qs[0], 'algo', qs)).toBe(END);
  });
  it('una regla que coincide gana sobre next y orden', () => {
    const q = { id: 'a', next: 'b', rules: [{ equals: 'Ventas', goto: 'z' }] };
    expect(resolveNext(q, 'Ventas', [q, { id: 'b' }, { id: 'z' }])).toBe('z');
  });
  it('si ninguna regla coincide, cae en next/orden', () => {
    const q = { id: 'a', rules: [{ equals: 'Ventas', goto: 'z' }] };
    expect(resolveNext(q, 'Otro', [q, { id: 'b' }])).toBe('b');
  });
  it('coincide por valor numérico (escala)', () => {
    const q = { id: 'a', rules: [{ equals: 1, goto: END }] };
    expect(resolveNext(q, 1, [q, { id: 'b' }])).toBe(END);
    expect(resolveNext(q, 2, [q, { id: 'b' }])).toBe('b');
  });
});

describe('flowErrors', () => {
  it('sin errores cuando los destinos existen o son END', () => {
    const qs = [{ id: 'a', next: 'c', rules: [{ equals: 'x', goto: END }] }, { id: 'b' }, { id: 'c' }];
    expect(flowErrors(qs)).toEqual([]);
  });
  it('detecta next o goto a un destino inexistente', () => {
    expect(flowErrors([{ id: 'a', next: 'nope' }]).length).toBeGreaterThan(0);
    expect(flowErrors([{ id: 'a', rules: [{ equals: 'x', goto: 'nope' }] }]).length).toBeGreaterThan(0);
    expect(flowErrors([{ id: 'a', rules: [{ equals: 'x' }] }]).length).toBeGreaterThan(0);
  });
  it('rechaza una autorreferencia (a → a)', () => {
    expect(flowErrors([{ id: 'a', next: 'a' }]).length).toBeGreaterThan(0);
  });
  it('rechaza un ciclo indirecto (a → c → a)', () => {
    const qs = [{ id: 'a', next: 'c' }, { id: 'b' }, { id: 'c', next: 'a' }];
    expect(flowErrors(qs).length).toBeGreaterThan(0);
  });
  it('rechaza un ciclo formado por una regla de salto', () => {
    const qs = [{ id: 'a' }, { id: 'b', rules: [{ equals: 1, goto: 'a' }] }];
    expect(flowErrors(qs).length).toBeGreaterThan(0);
  });
  it('un salto hacia adelante no es ciclo', () => {
    const qs = [{ id: 'a', next: 'c' }, { id: 'b' }, { id: 'c' }];
    expect(flowErrors(qs)).toEqual([]);
  });
});
