/**
 * Qué dispara la carga de la lista de retros del ingeniero (RMR-BUG-0049).
 *
 * El fallo original: solo se cargaba si la persona tenía manager, así que quien
 * pertenecía a un squad pero no tenía `ownerLeaderUid` no veía ni una retro. Se
 * ejercita el prototipo sobre un `this` mínimo, sin montar el componente Lit.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/retros.js', () => ({
  listRetros: vi.fn(async () => []),
  listRetrosBySquads: vi.fn(async () => []),
}));

const { RetroApp } = await import('./retro-app.js');
const { updated } = RetroApp.prototype;
const sourcesKey = Object.getOwnPropertyDescriptor(RetroApp.prototype, '_sourcesKey').get;

function makeCtx(over = {}) {
  return {
    leaderUid: null, squadIds: [], canManage: false, _loadedFor: null,
    _loadList: vi.fn(), get _sourcesKey() { return sourcesKey.call(this); },
    ...over,
  };
}

const changed = (...keys) => new Map(keys.map((k) => [k, undefined]));

describe('fuentes de retros del ingeniero', () => {
  it('carga con manager y sin squads', () => {
    const ctx = makeCtx({ leaderUid: 'lead1' });
    updated.call(ctx, changed('leaderUid'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('carga con squad aunque NO tenga manager', () => {
    const ctx = makeCtx({ squadIds: ['sq1'] });
    updated.call(ctx, changed('squadIds'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('recalcula si los squads llegan después que el manager', () => {
    const ctx = makeCtx({ leaderUid: 'lead1' });
    updated.call(ctx, changed('leaderUid'));
    ctx.squadIds = ['sq1'];
    updated.call(ctx, changed('squadIds'));
    expect(ctx._loadList).toHaveBeenCalledTimes(2);
  });

  it('no recarga si no ha cambiado ninguna fuente', () => {
    const ctx = makeCtx({ leaderUid: 'lead1', squadIds: ['sq1'] });
    updated.call(ctx, changed('leaderUid'));
    updated.call(ctx, changed('squadIds'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('el orden de los squads no cuenta como cambio', () => {
    const ctx = makeCtx({ leaderUid: 'lead1', squadIds: ['b', 'a'] });
    updated.call(ctx, changed('squadIds'));
    ctx.squadIds = ['a', 'b'];
    updated.call(ctx, changed('squadIds'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('sin manager ni squads no pide nada', () => {
    const ctx = makeCtx();
    updated.call(ctx, changed('leaderUid'));
    expect(ctx._loadList).not.toHaveBeenCalled();
  });

  it('el manager no usa esta lista (la trae retro-manager)', () => {
    const ctx = makeCtx({ leaderUid: 'lead1', canManage: true });
    updated.call(ctx, changed('leaderUid'));
    expect(ctx._loadList).not.toHaveBeenCalled();
  });
});
