import { describe, it, expect } from 'vitest';
import {
  magnitudeCard, axesAvailable, isAxisLevel, COMPLEXITY_LEVELS, EFFORT_LEVELS,
} from './magnitude.js';
import { buildDeck, POKER_DECK, SPLIT_CARD } from './deck.js';

describe('magnitudeCard: el cuadro del taller «Estimar en magnitud»', () => {
  it('reproduce el cuadro de Fibonacci casilla a casilla', () => {
    // Filas = complejidad 1..5, columnas = esfuerzo 1..5. P = partir.
    const cuadro = [
      ['1', '2', '3', '5', '8'],
      ['2', '3', '5', '8', '13'],
      ['3', '5', '8', '13', '21'],
      ['5', '8', '13', '21', 'P'],
      ['8', '13', '21', 'P', 'P'],
    ];
    for (const [ci, fila] of cuadro.entries()) {
      for (const [ei, esperado] of fila.entries()) {
        const carta = esperado === 'P' ? SPLIT_CARD : esperado;
        expect(magnitudeCard('fibonacci', ci + 1, ei + 1), `c${ci + 1} e${ei + 1}`).toBe(carta);
      }
    }
  });

  it('el 21 llega antes por la diagonal que por los lados', () => {
    // Todo cabeza y nada de trabajo vale lo mismo que todo trabajo y nada de cabeza.
    expect(magnitudeCard('fibonacci', 5, 1)).toBe('8');
    expect(magnitudeCard('fibonacci', 1, 5)).toBe('8');
    expect(magnitudeCard('fibonacci', 3, 3)).toBe('8');
  });

  it('lo más pequeño que existe es un 1: no hay ceros', () => {
    expect(magnitudeCard('fibonacci', 1, 1)).toBe('1');
    expect(magnitudeCard('fibonacci', 0, 1)).toBeNull();
    expect(magnitudeCard('fibonacci', 1, 6)).toBeNull();
    expect(magnitudeCard('fibonacci', undefined, 3)).toBeNull();
  });

  it('con tallas aplica la misma escalera sobre XS..XL', () => {
    expect(magnitudeCard('tallas', 1, 1)).toBe('XS');
    expect(magnitudeCard('tallas', 2, 2)).toBe('M');
    expect(magnitudeCard('tallas', 3, 3)).toBe('XL');
    expect(magnitudeCard('tallas', 3, 4)).toBe(SPLIT_CARD);
  });
});

describe('axesAvailable: solo si el mazo de la sesión tiene la escalera', () => {
  it('una sesión nueva de cualquier escala puede votar por ejes', () => {
    expect(axesAvailable({ scale: 'fibonacci', deck: buildDeck('fibonacci') })).toBe(true);
    expect(axesAvailable({ scale: 'tallas', deck: buildDeck('tallas') })).toBe(true);
  });

  it('una sesión antigua (mazo 0..100 sin 21 ni «partir») no: antes que emitir una carta inválida, se esconde', () => {
    expect(axesAvailable({})).toBe(false);
    expect(axesAvailable({ deck: POKER_DECK })).toBe(false);
    expect(axesAvailable({ scale: 'tallas', deck: ['S', 'M', '?', '☕'] })).toBe(false);
  });
});

describe('los ejes', () => {
  it('van del 1 al 5, enteros', () => {
    expect([1, 2, 3, 4, 5].every(isAxisLevel)).toBe(true);
    expect([0, 6, 2.5, '3', null].some(isAxisLevel)).toBe(false);
  });

  it('cada nivel lleva su descripción del taller', () => {
    for (const eje of [COMPLEXITY_LEVELS, EFFORT_LEVELS]) {
      expect(eje.map((n) => n.level)).toEqual([1, 2, 3, 4, 5]);
      expect(eje.every((n) => n.text && n.example)).toBe(true);
    }
  });
});
