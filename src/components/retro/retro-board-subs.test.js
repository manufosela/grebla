/**
 * Ciclo de vida de las suscripciones en vivo del tablero (RMR-TSK-0286).
 *
 * Es el punto donde se cuelan las fugas: un listener que no se corta al cambiar
 * de retro o al desmontar sigue leyendo (y facturando) para siempre. Se ejercita
 * el prototipo sobre un `this` mínimo, sin montar el componente Lit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const stops = { retro: vi.fn(), notes: vi.fn() };
const captured = {};

vi.mock('../../lib/retros.js', () => ({
  watchRetro: (id, onData, onError) => { captured.retro = { id, onData, onError }; return stops.retro; },
  watchNotes: (id, onData, onError) => { captured.notes = { id, onData, onError }; return stops.notes; },
  addNote: vi.fn(), voteNote: vi.fn(), unvoteNote: vi.fn(), editNote: vi.fn(),
  deleteNote: vi.fn(), setNoteGroups: vi.fn(), setRetroReveal: vi.fn(),
}));

const { RetroBoard } = await import('./retro-board.js');
const { _subscribe, _unsubscribe } = RetroBoard.prototype;

function makeCtx() {
  return {
    retroId: 'r1', _subs: [], _loading: false, _error: '', _retro: null, _notes: [], _composerCol: '',
    _unsubscribe, // `_subscribe` corta las anteriores antes de abrir las nuevas
  };
}

beforeEach(() => {
  stops.retro.mockClear();
  stops.notes.mockClear();
});

describe('suscripciones del tablero', () => {
  it('abre una suscripción a la retro y otra a sus notas', () => {
    const ctx = makeCtx();
    _subscribe.call(ctx);
    expect(ctx._subs).toHaveLength(2);
    expect(captured.retro.id).toBe('r1');
    expect(captured.notes.id).toBe('r1');
  });

  it('corta las anteriores al volver a suscribirse (cambio de retro)', () => {
    const ctx = makeCtx();
    _subscribe.call(ctx);
    _subscribe.call(ctx);
    expect(stops.retro).toHaveBeenCalledTimes(1);
    expect(stops.notes).toHaveBeenCalledTimes(1);
    expect(ctx._subs).toHaveLength(2);
  });

  it('las corta todas al desmontar y no las deja registradas', () => {
    const ctx = makeCtx();
    _subscribe.call(ctx);
    _unsubscribe.call(ctx);
    expect(stops.retro).toHaveBeenCalledTimes(1);
    expect(stops.notes).toHaveBeenCalledTimes(1);
    expect(ctx._subs).toEqual([]);
  });

  it('vuelca en el estado lo que llega por el canal en vivo', () => {
    const ctx = makeCtx();
    _subscribe.call(ctx);
    captured.retro.onData({ id: 'r1', format: 'barco', status: 'open' });
    captured.notes.onData([{ id: 'n1', columnId: 'viento', text: 'hola' }]);
    expect(ctx._retro.format).toBe('barco');
    expect(ctx._notes).toHaveLength(1);
    expect(ctx._loading).toBe(false);
    // El composer se coloca en la primera zona del formato recibido.
    expect(ctx._composerCol).toBe('viento');
  });

  it('un error del canal se muestra y deja de cargar', () => {
    const ctx = makeCtx();
    _subscribe.call(ctx);
    captured.retro.onError(new Error('permiso denegado'));
    expect(ctx._error).toBe('permiso denegado');
    expect(ctx._loading).toBe(false);
  });
});
