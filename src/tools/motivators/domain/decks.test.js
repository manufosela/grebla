import { describe, it, expect } from 'vitest';
import { DECKS, getDeck, deckCardIds } from './decks.js';
import { GAMES, DECK_SIZE } from './types.js';

describe('decks — datasets de los dos juegos', () => {
  it.each(GAMES)('%s tiene 10 cartas con id/nombre/descripción y sin ids repetidos', (game) => {
    const deck = getDeck(game);
    expect(deck.cards).toHaveLength(DECK_SIZE);
    expect(new Set(deck.cards.map((c) => c.id)).size).toBe(DECK_SIZE);
    for (const card of deck.cards) {
      expect(card.id).toBeTruthy();
      expect(card.name.trim()).not.toBe('');
      expect(card.description.trim()).not.toBe('');
    }
    expect(deck.name).toBeTruthy();
    expect(['teal', 'coral']).toContain(deck.accent);
  });

  it('hay exactamente dos mazos', () => {
    expect(Object.keys(DECKS).sort()).toEqual([...GAMES].sort());
  });

  it('deckCardIds devuelve los 10 ids en orden', () => {
    expect(deckCardIds('moving_motivators')).toHaveLength(DECK_SIZE);
    expect(deckCardIds('moving_motivators')[0]).toBe('curiosity');
  });

  it('getDeck lanza con un juego desconocido (sin fallback silencioso)', () => {
    expect(() => getDeck('nope')).toThrow();
  });
});
