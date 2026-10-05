/**
 * <brand-colors-editor> (RMR-TSK-0599): no deja guardar colores sin AA y lo
 * que guarda se pinta al momento. Métodos del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const style = vi.hoisted(() => ({ applyBrandStyle: vi.fn() }));
vi.mock('../../lib/brandStyle.js', () => style);

const { BrandColorsEditor } = await import('./brand-colors-editor.js');
const { _save } = BrandColorsEditor.prototype;
const legibles = { brand: '#1e3a5f', accent: '#2a9d8f', affective: '#c0392b' };

describe('<brand-colors-editor> — el borrador espera a saber qué hay guardado', () => {
  const { willUpdate } = BrandColorsEditor.prototype;
  const changed = new Map([['colors', undefined]]);

  it('mientras no llega lo guardado (undefined), no hay borrador', () => {
    const ctx = { colors: undefined, _draft: null };
    willUpdate.call(ctx, changed);
    expect(ctx._draft).toBeNull();
  });

  it('llega lo guardado: el borrador sale de ahí, no de los de GREBLA', () => {
    const ctx = { colors: { ...legibles, accent: '#1f766c' }, _draft: null };
    willUpdate.call(ctx, changed);
    expect(ctx._draft.accent).toBe('#1f766c');
  });

  it('sin colores propios (null), el borrador empieza con los de GREBLA', () => {
    const ctx = { colors: null, _draft: null };
    willUpdate.call(ctx, changed);
    expect(ctx._draft).toEqual({ brand: '#1e3a5f', accent: '#2a9d8f', affective: '#c0392b' });
  });
});

describe('<brand-colors-editor>', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('guarda colores legibles, los pinta al momento y retira el overlay', async () => {
    const save = vi.fn().mockResolvedValue();
    const ctx = { save, _draft: { ...legibles }, _busy: false, _error: '', _saved: false };
    await _save.call(ctx);
    expect(save).toHaveBeenCalledWith(legibles);
    expect(style.applyBrandStyle).toHaveBeenCalledWith(expect.stringContaining('--gr-teal:#2a9d8f'));
    expect(ctx).toMatchObject({ _busy: false, _saved: true, _error: '' });
  });

  it('con un color sin AA no llama a guardar: dice qué par falla', async () => {
    const save = vi.fn();
    const ctx = { save, _draft: { ...legibles, accent: '#a8e6cf' }, _busy: false, _error: '', _saved: false };
    await _save.call(ctx);
    expect(save).not.toHaveBeenCalled();
    expect(ctx._error).toMatch(/^Acento sobre fondo claro/);
  });

  it('si guardar falla, se ve el error y no se pinta nada', async () => {
    const save = vi.fn().mockRejectedValue(new Error('sin permiso'));
    const ctx = { save, _draft: { ...legibles }, _busy: false, _error: '', _saved: false };
    await _save.call(ctx);
    expect(ctx).toMatchObject({ _busy: false, _saved: false, _error: 'sin permiso' });
    expect(style.applyBrandStyle).not.toHaveBeenCalled();
  });
});
