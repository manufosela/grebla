import { describe, it, expect } from 'vitest';
import { POKER_DECK, isNumericCard, cardNumber, isValidCard } from './deck.js';

describe('POKER_DECK', () => {
  it('es la escala Fibonacci de planning poker más las dos especiales', () => {
    expect(POKER_DECK).toEqual(['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕']);
  });
});

describe('isNumericCard', () => {
  it('las cartas de número son numéricas', () => {
    expect(isNumericCard('0')).toBe(true);
    expect(isNumericCard('100')).toBe(true);
  });

  it('las especiales y la basura no lo son', () => {
    expect(isNumericCard('?')).toBe(false);
    expect(isNumericCard('☕')).toBe(false);
    expect(isNumericCard('')).toBe(false);
    expect(isNumericCard(null)).toBe(false);
  });
});

describe('cardNumber', () => {
  it('devuelve el número de las numéricas', () => {
    expect(cardNumber('8')).toBe(8);
    expect(cardNumber('0')).toBe(0);
  });

  it('devuelve null en las especiales', () => {
    expect(cardNumber('?')).toBeNull();
    expect(cardNumber('☕')).toBeNull();
  });
});

describe('isValidCard', () => {
  it('acepta solo cartas del mazo', () => {
    expect(isValidCard('13')).toBe(true);
    expect(isValidCard('☕')).toBe(true);
  });

  it('rechaza cualquier valor fuera del mazo', () => {
    expect(isValidCard('7')).toBe(false);
    expect(isValidCard('99')).toBe(false);
    expect(isValidCard('')).toBe(false);
    expect(isValidCard(undefined)).toBe(false);
  });
});
