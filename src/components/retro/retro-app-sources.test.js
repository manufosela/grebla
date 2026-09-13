/**
 * Qué dispara la carga de la lista de retros del ingeniero (RMR-BUG-0049).
 *
 * El fallo original: solo se cargaba si la persona tenía manager, así que quien
 * pertenecía a un squad pero no tenía `ownerLeaderUid` no veía ni una retro.
 *
 * Desde el ADR «Retros por membresía» la lista va por QUIEN MIRA (`uid`): son
 * las retros en las que está dentro más las de su rama. Y desde la F5 del ADR
 * de dominios, esa es la ÚNICA fuente — ya no se pregunta por squad—, así que
 * el bug original no puede volver por otra vía: sin manager y sin nada más, con
 * saber quién mira ya se carga.
 *
 * Se ejercita el prototipo sobre un `this` mínimo, sin montar el componente Lit.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/retros.js', () => ({
  listRetros: vi.fn(async () => []),
}));

const { RetroApp } = await import('./retro-app.js');
const { updated } = RetroApp.prototype;
const sourcesKey = Object.getOwnPropertyDescriptor(RetroApp.prototype, '_sourcesKey').get;

function makeCtx(over = {}) {
  return {
    uid: null, leaderUid: null, canManage: false, _loadedFor: null,
    _loadList: vi.fn(), get _sourcesKey() { return sourcesKey.call(this); },
    ...over,
  };
}

const changed = (...keys) => new Map(keys.map((k) => [k, undefined]));

describe('fuentes de retros del ingeniero', () => {
  it('carga en cuanto se sabe quién mira', () => {
    const ctx = makeCtx({ uid: 'ana' });
    updated.call(ctx, changed('uid'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('carga aunque NO tenga manager: es lo que arregló el bug', () => {
    const ctx = makeCtx({ uid: 'ana', leaderUid: null });
    updated.call(ctx, changed('uid'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('no recarga si no ha cambiado quién mira', () => {
    const ctx = makeCtx({ uid: 'ana' });
    updated.call(ctx, changed('uid'));
    updated.call(ctx, changed('leaderUid'));
    expect(ctx._loadList).toHaveBeenCalledTimes(1);
  });

  it('sin saber quién mira no pide nada', () => {
    const ctx = makeCtx();
    updated.call(ctx, changed('leaderUid'));
    expect(ctx._loadList).not.toHaveBeenCalled();
  });

  it('el manager no usa esta lista (la trae retro-manager)', () => {
    const ctx = makeCtx({ uid: 'ana', canManage: true });
    updated.call(ctx, changed('uid'));
    expect(ctx._loadList).not.toHaveBeenCalled();
  });
});
