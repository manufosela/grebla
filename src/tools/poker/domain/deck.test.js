import { describe, it, expect } from 'vitest';
import { POKER_DECK, isNumericCard, cardNumber, isValidCard, deckOf, buildDeck, isValidCardFor, cardLabel } from './deck.js';

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

describe('buildDeck: el mazo de una escala es fijo (RMR-TSK-0515)', () => {
  it('Fibonacci va del 1 al 21, con «no sé», «pausa» y «partir» al final', () => {
    // Sin 0: si algo existe, cuesta algo. Sin 40 ni 100: eso no se estima, se parte.
    expect(buildDeck('fibonacci')).toEqual(['1', '2', '3', '5', '8', '13', '21', '?', '☕', 'partir']);
  });

  it('las tallas van de XS a XL', () => {
    expect(buildDeck('tallas')).toEqual(['XS', 'S', 'M', 'L', 'XL', '?', '☕', 'partir']);
  });

  it('las especiales van siempre: quien no lo tiene claro no inventa un número', () => {
    for (const id of ['fibonacci', 'tallas']) {
      expect(buildDeck(id).slice(-3)).toEqual(['?', '☕', 'partir']);
    }
  });

  it('«partir» no es una cantidad: ni se promedia ni se pinta como número', () => {
    expect(isNumericCard('partir')).toBe(false);
    expect(cardNumber('partir')).toBeNull();
    expect(cardLabel('partir')).toBe('✂');
    expect(cardLabel('13')).toBe('13');
  });

  it('una escala desconocida cae en Fibonacci en vez de dejar la mesa vacía', () => {
    expect(buildDeck('inventada')).toEqual(buildDeck('fibonacci'));
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
