import { describe, it, expect } from 'vitest';
import { selectPokerGuilds } from './guilds.js';

describe('selectPokerGuilds', () => {
  it('solo globales con nombre y que estiman, ordenados', () => {
    expect(selectPokerGuilds([
      { name: 'QA' }, { name: 'Backend PHP' }, { name: 'Tech Lead', estimates: false },
      { name: 'Mío', ownerLeaderUid: 'u1' }, { name: '  ' }, { estimates: true }, null,
      { name: 'Android', estimates: true },
    ])).toEqual(['Android', 'Backend PHP', 'QA']);
  });
  it('sin catálogo, nada', () => {
    expect(selectPokerGuilds(undefined)).toEqual([]);
  });
});
