/**
 * <manager-notes> (RMR-TSK-0636): se ejercitan los métodos reales del prototipo
 * sobre un `this` mínimo, como en notion-sync.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ listManagerNotes: vi.fn() }));
vi.mock('../../lib/managerNotes.js', () => lib);

const { ManagerNotes } = await import('./manager-notes.js');
const { _load } = ManagerNotes.prototype;

const ctx = (extra = {}) => ({ personId: 'p1', _notes: [], _loading: false, _error: '', ...extra });

describe('<manager-notes> — notas privadas del manager', () => {
  beforeEach(() => { vi.resetAllMocks(); lib.listManagerNotes.mockResolvedValue([]); });

  it('si cambia de persona mientras carga, no pinta las notas de la anterior', async () => {
    const c = ctx();
    let resolve;
    lib.listManagerNotes.mockReturnValue(new Promise((r) => { resolve = r; }));
    const pending = _load.call(c);
    c.personId = 'p2';
    resolve([{ id: 'n1', content: 'de p1' }]);
    await pending;
    expect(c._notes).toEqual([]);
  });

  it('al cambiar de persona se vacía antes de pintar, también si se queda sin persona', () => {
    const c = ctx({ personId: '', _notes: [{ id: 'de-otra' }], _error: 'x' });
    ManagerNotes.prototype.willUpdate.call(c, new Map([['personId', 'p1']]));
    expect(c._notes).toEqual([]);
    expect(c._error).toBe('');
    expect(c._loading).toBe(false);
  });

  it('carga las notas de la persona', async () => {
    const c = ctx();
    lib.listManagerNotes.mockResolvedValue([{ id: 'n1' }]);
    await _load.call(c);
    expect(lib.listManagerNotes).toHaveBeenCalledWith('p1');
    expect(c._notes).toEqual([{ id: 'n1' }]);
    expect(c._loading).toBe(false);
  });

  it('si no se pueden leer, lo dice en vez de enseñar una lista vacía', async () => {
    const c = ctx();
    lib.listManagerNotes.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    await _load.call(c);
    expect(c._error).toMatch(/No se pudieron cargar las notas privadas/);
  });
});
