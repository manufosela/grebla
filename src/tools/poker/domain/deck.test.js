import { describe, it, expect } from 'vitest';
import { POKER_DECK, isNumericCard, cardNumber, isValidCard, deckOf, buildDeck, isValidCardFor } from './deck.js';

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

/**
 * Escalas y mazo por sesión (RMR-TSK-0481).
 *
 * Lo que más pesa aquí es lo que NO debe cambiar: una sesión convocada antes de
 * que existieran las escalas está en curso, y cambiarle las cartas a mitad de
 * una estimación invalidaría los votos ya emitidos.
 */
describe('deckOf: el mazo es de la sesión', () => {
  it('usa el que se guardó al convocarla', () => {
    expect(deckOf({ deck: ['S', 'M', 'L', '?'] })).toEqual(['S', 'M', 'L', '?']);
  });

  it('una sesión SIN mazo guardado sigue con el Fibonacci de siempre', () => {
    for (const s of [{}, { deck: null }, { deck: [] }, null, undefined]) {
      expect(deckOf(s)).toEqual(POKER_DECK);
    }
  });
});

describe('buildDeck: qué cartas quedan al convocar', () => {
  it('solo las marcadas, en el orden de la escala', () => {
    expect(buildDeck('fibonacci', ['8', '1', '3'])).toEqual(['1', '3', '8', '?', '☕']);
  });

  it('las especiales van siempre: «no sé» y «pausa» no se pueden quitar', () => {
    // Sin ellas, quien no lo tiene claro se ve obligado a inventar un número.
    expect(buildDeck('tallas', ['M'])).toEqual(['M', '?', '☕']);
  });

  it('sin marcar ninguna va la escala entera, no una mesa sin cartas', () => {
    expect(buildDeck('tallas')).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']);
    expect(buildDeck('tallas', [])).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']);
  });

  it('una escala desconocida cae en Fibonacci en vez de dejar la mesa vacía', () => {
    expect(buildDeck('inventada', ['5'])).toEqual(['5', '?', '☕']);
  });

  it('ignora cartas que no son de la escala elegida', () => {
    expect(buildDeck('tallas', ['M', '13'])).toEqual(['M', '?', '☕']);
  });
});

describe('isValidCardFor: se vota lo que ESA sesión permite', () => {
  it('una sesión de tallas no acepta un número del otro mazo', () => {
    const sesion = { deck: ['S', 'M', 'L', '?', '☕'] };
    expect(isValidCardFor(sesion, 'M')).toBe(true);
    expect(isValidCardFor(sesion, '13')).toBe(false);
  });

  it('una sesión antigua acepta lo de siempre', () => {
    expect(isValidCardFor({}, '13')).toBe(true);
    expect(isValidCardFor({}, 'M')).toBe(false);
  });
});

describe('las tallas no se promedian', () => {
  it('una talla no es una cantidad', () => {
    // Una media entre S y XL no significa nada; el resumen ya lo sabía, y esto
    // lo fija ahora que hay una escala entera no numérica.
    for (const talla of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
      expect(isNumericCard(talla)).toBe(false);
      expect(cardNumber(talla)).toBeNull();
    }
  });
});
