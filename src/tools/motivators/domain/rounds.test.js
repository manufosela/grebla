import { describe, it, expect } from 'vitest';
import { isRoundOpen, roundStatus, pickOpenRound, sortRoundsChronologically, dayWindowToIso } from './rounds.js';

const round = (id, startAt, endAt, active = true) => ({ id, game: 'g', name: id, startAt, endAt, active });
const NOW = new Date('2026-07-13T12:00:00Z');

describe('isRoundOpen', () => {
  it('true solo si activa y dentro de la ventana', () => {
    expect(isRoundOpen(round('r', '2026-07-12T00:00:00Z', '2026-07-15T00:00:00Z'), NOW)).toBe(true);
  });
  it('false si desactivada, antes de empezar o después de terminar', () => {
    expect(isRoundOpen(round('r', '2026-07-12T00:00:00Z', '2026-07-15T00:00:00Z', false), NOW)).toBe(false);
    expect(isRoundOpen(round('r', '2026-07-14T00:00:00Z', '2026-07-16T00:00:00Z'), NOW)).toBe(false);
    expect(isRoundOpen(round('r', '2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z'), NOW)).toBe(false);
  });
});

describe('roundStatus', () => {
  it('distingue upcoming / open / closed', () => {
    expect(roundStatus(round('r', '2026-07-14T00:00:00Z', '2026-07-16T00:00:00Z'), NOW)).toBe('upcoming');
    expect(roundStatus(round('r', '2026-07-12T00:00:00Z', '2026-07-15T00:00:00Z'), NOW)).toBe('open');
    expect(roundStatus(round('r', '2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z'), NOW)).toBe('closed');
  });
});

describe('pickOpenRound', () => {
  it('elige la ronda abierta más reciente', () => {
    const rounds = [
      round('old', '2026-07-10T00:00:00Z', '2026-07-20T00:00:00Z'),
      round('new', '2026-07-12T00:00:00Z', '2026-07-20T00:00:00Z'),
      round('closed', '2026-06-01T00:00:00Z', '2026-06-10T00:00:00Z'),
    ];
    expect(pickOpenRound(rounds, NOW)?.id).toBe('new');
    expect(pickOpenRound([], NOW)).toBe(null);
  });
});

describe('sortRoundsChronologically', () => {
  it('ordena por startAt ascendente', () => {
    const rounds = [
      round('b', '2026-07-05T00:00:00Z', '2026-07-08T00:00:00Z'),
      round('a', '2026-07-01T00:00:00Z', '2026-07-04T00:00:00Z'),
    ];
    expect(sortRoundsChronologically(rounds).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('dayWindowToIso', () => {
  it('abre el primer día y cierra al final del último (inclusive)', () => {
    expect(dayWindowToIso('2026-07-12', '2026-07-14')).toEqual({
      startAt: '2026-07-12T00:00:00.000Z',
      endAt: '2026-07-14T23:59:59.999Z',
    });
  });
});
