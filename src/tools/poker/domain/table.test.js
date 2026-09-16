import { describe, it, expect } from 'vitest';
import { cardStates, allActiveVoted } from './table.js';

const MAZO = ['1', '2', '3', '5', '8', '13', 'partir'];
const players = [
  { uid: 'a', name: 'Ana', votedRound: 2 },
  { uid: 'b', name: 'Bea', votedRound: 1 },
  { uid: 'c', name: 'Cai', votedRound: 2 },
  { uid: 'o', name: 'Observa', spectator: true, votedRound: 2 },
  { uid: 'f', name: 'Fuera', skippedRound: 2 },
];
const votes = {
  a: { value: '3', round: 2, axes: { complexity: 2, effort: 2 } },
  b: { value: '8', round: 1 },
  c: { value: '8', round: 2 },
};

describe('cardStates: una carta por quien vota', () => {
  it('sienta a quienes votan en la ronda: ni observadores ni fuera de ámbito', () => {
    const { seats } = cardStates({ players, votesByUid: votes, round: 2, revealed: false, deck: MAZO });
    expect(seats.map((s) => s.uid)).toEqual(['a', 'b', 'c']);
  });

  it('boca abajo: se sabe quién ha votado esta ronda, nunca el valor', () => {
    const { seats, verdict } = cardStates({ players, votesByUid: votes, round: 2, revealed: false, deck: MAZO });
    expect(seats.map((s) => [s.voted, s.value, s.tone])).toEqual([
      [true, null, 'hidden'], [false, null, 'hidden'], [true, null, 'hidden'],
    ]);
    expect(verdict).toBeNull();
  });

  it('al revelar, las cartas giran con su valor y sus ejes; el voto viejo de Bea no cuenta', () => {
    const { seats } = cardStates({ players, votesByUid: votes, round: 2, revealed: true, deck: MAZO });
    expect(seats[0]).toMatchObject({ value: '3', axes: { complexity: 2, effort: 2 }, tone: 'low' });
    expect(seats[1]).toMatchObject({ value: null, tone: 'empty' });
    expect(seats[2]).toMatchObject({ value: '8', axes: null, tone: 'high' });
  });

  it('si coinciden, todas en verde: es acuerdo', () => {
    const iguales = { a: { value: '5', round: 2 }, c: { value: '5', round: 2 } };
    const { seats, verdict } = cardStates({ players, votesByUid: iguales, round: 2, revealed: true, deck: MAZO });
    expect(verdict.consensus).toBe(true);
    expect(seats.filter((s) => s.value).every((s) => s.tone === 'agree')).toBe(true);
  });

  it('con tres valores, la del medio no se colorea; con dos iguales en un extremo, las dos', () => {
    const ps = [{ uid: 'a', votedRound: 1 }, { uid: 'b', votedRound: 1 }, { uid: 'c', votedRound: 1 }, { uid: 'd', votedRound: 1 }];
    const vs = { a: { value: '3', round: 1 }, b: { value: '5', round: 1 }, c: { value: '13', round: 1 }, d: { value: '13', round: 1 } };
    const { seats } = cardStates({ players: ps, votesByUid: vs, round: 1, revealed: true, deck: MAZO });
    expect(seats.map((s) => s.tone)).toEqual(['low', 'plain', 'high', 'high']);
  });

  it('sin nombre se dice, en vez de dejar la carta muda', () => {
    const { seats } = cardStates({ players: [{ uid: 'x', votedRound: null }], round: 1, revealed: false });
    expect(seats[0].name).toBe('Sin nombre');
  });
});

describe('allActiveVoted: cuándo puede el organizador destapar', () => {
  it('solo cuando todos los que votan han votado esta ronda', () => {
    expect(allActiveVoted(players, 2)).toBe(false);
    expect(allActiveVoted([{ uid: 'a', votedRound: 2 }, { uid: 'o', spectator: true }], 2)).toBe(true);
  });

  it('con nadie sentado no hay nada que destapar', () => {
    expect(allActiveVoted([], 1)).toBe(false);
    expect(allActiveVoted([{ uid: 'o', spectator: true }], 1)).toBe(false);
  });
});
