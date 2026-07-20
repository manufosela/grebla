/**
 * Con qué nombre se firma una tarjeta (RMR-TSK-0285 / ajuste posterior): manda
 * el de la ficha de GREBLA, y solo si no hay se cae al de la cuenta de Google.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/retros.js', () => ({
  watchRetro: vi.fn(), watchNotes: vi.fn(), addNote: vi.fn(), voteNote: vi.fn(),
  unvoteNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn(),
  setNoteGroups: vi.fn(), setRetroReveal: vi.fn(),
}));
vi.mock('../../lib/auth.js', () => ({ getCurrentUser: () => ({ displayName: 'manu (google)' }) }));

const { RetroBoard } = await import('./retro-board.js');
const myName = Object.getOwnPropertyDescriptor(RetroBoard.prototype, '_myName').get;

const nameOf = (ctx) => myName.call({ uid: 'u1', members: [], authorName: '', ...ctx });

describe('firma de la tarjeta', () => {
  it('usa el nombre de la ficha de GREBLA si lo hay', () => {
    expect(nameOf({ authorName: 'Manu Fosela' })).toBe('Manu Fosela');
  });

  it('cae al roster del equipo cuando no hay ficha propia', () => {
    expect(nameOf({ members: [{ uid: 'u1', name: 'Manu (roster)' }] })).toBe('Manu (roster)');
  });

  it('cae a la cuenta de Google cuando no hay ninguno de los anteriores', () => {
    expect(nameOf({})).toBe('manu (google)');
  });

  it('un nombre de ficha en blanco no gana al de Google', () => {
    expect(nameOf({ authorName: '   ' })).toBe('manu (google)');
  });
});
