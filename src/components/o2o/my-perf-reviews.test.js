/**
 * <my-perf-reviews> (RMR-TSK-0544): se ejercitan los métodos reales del
 * prototipo sobre un `this` mínimo, como en manager-notes.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ listOwnPerfReviews: vi.fn() }));
vi.mock('../../lib/managerNotes.js', () => lib);

const { MyPerfReviews } = await import('./my-perf-reviews.js');
const { _load, _renderList } = MyPerfReviews.prototype;

const ctx = (extra = {}) => ({ personId: 'p1', _reviews: [], _loading: false, _error: '', ...extra });
/** Texto plano de una plantilla de Lit (cadenas + valores, recursivo). */
const textOf = (t) => {
  if (Array.isArray(t)) return t.map(textOf).join('');
  if (t?.strings) return t.strings.join('') + t.values.map(textOf).join('');
  return String(t ?? '');
};

describe('<my-perf-reviews> — la persona lee sus performance reviews', () => {
  beforeEach(() => { vi.resetAllMocks(); lib.listOwnPerfReviews.mockResolvedValue([]); });

  it('pide solo las de esa persona y las guarda', async () => {
    const c = ctx();
    lib.listOwnPerfReviews.mockResolvedValue([{ id: 'r1', title: 'Review julio' }]);
    await _load.call(c, 'p1');
    expect(lib.listOwnPerfReviews).toHaveBeenCalledWith('p1');
    expect(c._reviews).toEqual([{ id: 'r1', title: 'Review julio' }]);
    expect(c._loading).toBe(false);
  });

  it('si cambia de persona mientras carga, no pinta las de la anterior', async () => {
    const c = ctx();
    let resolve;
    lib.listOwnPerfReviews.mockReturnValue(new Promise((r) => { resolve = r; }));
    const pending = _load.call(c, 'p1');
    c.personId = 'p2';
    resolve([{ id: 'r1' }]);
    await pending;
    expect(c._reviews).toEqual([]);
  });

  it('si no se pueden leer, lo dice en vez de enseñar una lista vacía', async () => {
    const c = ctx();
    lib.listOwnPerfReviews.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    await _load.call(c, 'p1');
    expect(c._error).toMatch(/No se pudieron cargar tus performance reviews/);
  });

  it('pinta título, fecha y contenido, sin botones de editar ni borrar', () => {
    const c = ctx({ _reviews: [{ id: 'r1', title: 'Review julio', date: '2026-07-30', content: 'Buen semestre.' }] });
    const text = textOf(_renderList.call(c));
    expect(text).toContain('Review julio');
    expect(text).toContain('2026-07-30');
    expect(text).toContain('Buen semestre.');
    expect(text).not.toContain('<button');
  });

  it('sin reviews lo dice, en vez de dejar la pestaña en blanco', () => {
    expect(textOf(_renderList.call(ctx()))).toContain('Aún no tienes ninguna performance review');
  });
});
