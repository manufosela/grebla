/**
 * <notion-sync> y su pestaña (RMR-TSK-0623). Se ejercitan los métodos reales
 * del prototipo sobre un `this` mínimo, como en superadmin-panel-busy.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ runNotionSync: vi.fn(), peopleNames: vi.fn(), isNotionSynced: vi.fn(), getLastNotionSync: vi.fn() }));
vi.mock('../../lib/notionSync.js', () => lib);

const { NotionSync } = await import('./notion-sync.js');
const { SuperadminPanel } = await import('../superadmin-panel.js');
const { _run } = NotionSync.prototype;

const fresh = () => ({ _error: '', _busy: '', _simulated: false, _report: null, _names: new Map() });

describe('<notion-sync> — «Aplicar» solo tras la última simulación correcta', () => {
  beforeEach(() => { vi.resetAllMocks(); lib.peopleNames.mockResolvedValue(new Map()); });

  it('una simulación correcta habilita aplicar y retira el overlay', async () => {
    const ctx = fresh();
    lib.runNotionSync.mockResolvedValue({ counts: {}, errors: [] });
    await _run.call(ctx, false);
    expect(lib.runNotionSync).toHaveBeenCalledWith(false);
    expect(ctx._simulated).toBe(true);
    expect(ctx._busy).toBe('');
  });

  it('si la simulación falla, la anterior ya no vale y se ve el error', async () => {
    const ctx = { ...fresh(), _simulated: true };
    lib.runNotionSync.mockRejectedValue(new Error('Notion 401'));
    await _run.call(ctx, false);
    expect(ctx._simulated).toBe(false);
    expect(ctx._error).toBe('Notion 401');
    expect(ctx._busy).toBe('');
  });

  it('tras aplicar hay que volver a simular para aplicar otra vez', async () => {
    const ctx = { ...fresh(), _simulated: true };
    lib.runNotionSync.mockResolvedValue({ counts: {}, errors: [], applied: true });
    await _run.call(ctx, true);
    expect(lib.runNotionSync).toHaveBeenCalledWith(true);
    expect(ctx._simulated).toBe(false);
  });
});

describe('pestaña Notion del panel', () => {
  it('un viewer no la ve aunque llegue por la URL', () => {
    expect(SuperadminPanel.prototype._renderNotion.call({ readOnly: true })).toBeNull();
    expect(SuperadminPanel.prototype._renderNotion.call({ readOnly: false })).not.toBeNull();
  });

  it('va antes de Usuarios: Permisos sigue justo detrás de Usuarios', () => {
    const tabs = SuperadminPanel.prototype._renderGovernanceTabs.call({ readOnly: false, _tab: 'users', _setTab() {} });
    expect(tabs.map((t) => t.values.at(-1))).toEqual(['Notion', 'Usuarios']);
  });
});
