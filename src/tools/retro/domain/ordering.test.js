import { describe, it, expect } from 'vitest';
import { isSortedByVotes, orderGroups } from './ordering.js';

const ts = (ms) => ({ toMillis: () => ms });

describe('isSortedByVotes', () => {
  it('en una retro abierta no ordena hasta que quien facilita lo pide', () => {
    expect(isSortedByVotes({ status: 'open' })).toBe(false);
    expect(isSortedByVotes({ status: 'open', sortByVotes: true })).toBe(true);
  });

  it('una retro cerrada se lee ordenada por votos', () => {
    expect(isSortedByVotes({ status: 'closed' })).toBe(true);
  });

  it('sin retro no ordena', () => {
    expect(isSortedByVotes(null)).toBe(false);
  });
});

describe('orderGroups', () => {
  const group = (id, votes, ...created) => ({ id, votes, notes: created.map((ms) => ({ createdAt: ms === null ? null : ts(ms) })) });
  const groups = [group('b', 3, 200), group('a', 1, 100), group('c', 2, 300)];

  it('sin ordenar, votar no mueve nada: manda la hora de creación', () => {
    expect(orderGroups(groups, false).map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('ordenada, más votos primero y a igualdad el más antiguo', () => {
    const tied = [...groups, group('d', 2, 50)];
    expect(orderGroups(tied, true).map((g) => g.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('un grupo nace con su nota más antigua', () => {
    const merged = [group('solo', 0, 100), group('pair', 0, 400, 20)];
    expect(orderGroups(merged, false).map((g) => g.id)).toEqual(['pair', 'solo']);
  });

  it('las notas recién escritas (hora aún sin sellar) van al final, en su orden', () => {
    const fresh = [group('new', 0, null), group('new2', 0, null), group('old', 0, 10)];
    expect(orderGroups(fresh, false).map((g) => g.id)).toEqual(['old', 'new', 'new2']);
  });

  it('no muta la lista recibida', () => {
    const copy = [...groups];
    orderGroups(groups, true);
    expect(groups).toEqual(copy);
  });
});
