/**
 * <manager-notes>: añadir, editar y borrar (RMR-TSK-0636). Métodos reales del
 * prototipo sobre un `this` mínimo, como en manager-notes.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({
  listManagerNotes: vi.fn(), addManagerNote: vi.fn(), updateManagerNote: vi.fn(), deleteManagerNote: vi.fn(),
}));
vi.mock('../../lib/managerNotes.js', () => lib);

const { ManagerNotes } = await import('./manager-notes.js');
const { _load, _save, _delete, _write, _cancel } = ManagerNotes.prototype;

const ctx = (extra = {}) => ({
  personId: 'p1', _notes: [], _loading: false, _error: '', _busy: '', _editingId: null, _confirmDelete: null,
  _draft: { type: 'perf-review', date: '2026-06-30', title: '', content: 'Buen semestre.' },
  _load, _write, _cancel, ...extra,
});

describe('<manager-notes> — añadir, editar y borrar', () => {
  beforeEach(() => { vi.resetAllMocks(); lib.listManagerNotes.mockResolvedValue([]); });

  it('una nota sin contenido no se guarda y dice por qué', async () => {
    const c = ctx({ _draft: { type: 'perf-review', date: '2026-06-30', title: '', content: ' ' } });
    await _save.call(c);
    expect(lib.addManagerNote).not.toHaveBeenCalled();
    expect(c._error).toBe('Escribe el contenido.');
  });

  it('guardar una nueva la da de alta, recarga y limpia el formulario', async () => {
    const c = ctx();
    lib.listManagerNotes.mockResolvedValue([{ id: 'n1' }]);
    await _save.call(c);
    expect(lib.addManagerNote).toHaveBeenCalledWith('p1', expect.objectContaining({ content: 'Buen semestre.' }));
    expect(c._notes).toEqual([{ id: 'n1' }]);
    expect(c._draft.content).toBe('');
    expect(c._busy).toBe('');
  });

  it('editando, guarda sobre la misma nota', async () => {
    await _save.call(ctx({ _editingId: 'n1' }));
    expect(lib.updateManagerNote).toHaveBeenCalledWith('p1', 'n1', expect.any(Object));
    expect(lib.addManagerNote).not.toHaveBeenCalled();
  });

  it('borrar borra esa nota y cierra la confirmación', async () => {
    const c = ctx({ _confirmDelete: 'n1' });
    await _delete.call(c, { id: 'n1' });
    expect(lib.deleteManagerNote).toHaveBeenCalledWith('p1', 'n1');
    expect(c._confirmDelete).toBeNull();
  });

  it('si la escritura falla, se ve el error y se retira la capa de espera', async () => {
    const c = ctx();
    lib.addManagerNote.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    await _save.call(c);
    expect(c._error).toBe('Missing or insufficient permissions.');
    expect(c._busy).toBe('');
  });
});
