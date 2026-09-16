import { describe, it, expect } from 'vitest';
import { isNumericCard, cardNumber, deckOf, buildDeck, isValidCardFor, cardLabel } from './deck.js';

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

/**
 * Escalas y mazo por sesión (RMR-TSK-0481).
 *
 * Lo que más pesa aquí es lo que NO debe cambiar: una sesión convocada antes de
 * que existieran las escalas está en curso, y cambiarle las cartas a mitad de
 * una estimación invalidaría los votos ya emitidos.
 */
describe('deckOf: el mazo es el de la escala de la sesión (RMR-BUG-0122)', () => {
  it('sale de la escala, no de lo que se guardó al convocar', () => {
    expect(deckOf({ scale: 'tallas', deck: ['S', 'M', '?'] })).toEqual(['XS', 'S', 'M', 'L', 'XL', 'partir']);
  });

  it('una sesión antigua sin escala vota con el Fibonacci de ahora, no con el de 0 a 100', () => {
    for (const s of [{}, { deck: ['0', '100', '?'] }, null, undefined]) {
      expect(deckOf(s)).toEqual(['1', '2', '3', '5', '8', '13', 'partir']);
    }
  });
});

describe('buildDeck: el mazo de una escala es fijo (RMR-TSK-0515)', () => {
  it('Fibonacci va del 1 al 13, y lo que era 21 es «partir»', () => {
    // Sin 0: si algo existe, cuesta algo. Sin ? ni ☕: se pregunta antes de votar.
    expect(buildDeck('fibonacci')).toEqual(['1', '2', '3', '5', '8', '13', 'partir']);
  });

  it('las tallas van de XS a XL, más «partir»', () => {
    expect(buildDeck('tallas')).toEqual(['XS', 'S', 'M', 'L', 'XL', 'partir']);
  });

  it('«partir» va siempre: lo que es demasiado grande se dice, no se le pone cifra', () => {
    for (const id of ['fibonacci', 'tallas']) {
      expect(buildDeck(id).at(-1)).toBe('partir');
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
    const sesion = { scale: 'tallas' };
    expect(isValidCardFor(sesion, 'M')).toBe(true);
    expect(isValidCardFor(sesion, '13')).toBe(false);
  });

  it('una sesión antigua acepta el Fibonacci de ahora y ya no el 100 ni el «?»', () => {
    expect(isValidCardFor({}, '13')).toBe(true);
    expect(isValidCardFor({}, '100')).toBe(false);
    expect(isValidCardFor({}, '?')).toBe(false);
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
