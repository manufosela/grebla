/**
 * <person-o2o> (RMR-TSK-0649): los O2O hechos de una persona en su ficha, los
 * mismos que en la herramienta O2O. Métodos reales del prototipo sobre un
 * `this` mínimo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const deps = vi.hoisted(() => ({ createO2OContainer: vi.fn(), listSessions: vi.fn() }));
vi.mock('../../tools/o2o/composition/container.js', () => ({ createO2OContainer: deps.createO2OContainer }));
vi.mock('../../tools/o2o/application/usecases/sessions.js', () => ({ listSessions: deps.listSessions }));

const { PersonO2O } = await import('./person-o2o.js');
const { _load } = PersonO2O.prototype;

const ctx = (extra = {}) => ({ personId: 'p1', leaderUid: 'manager', _sessions: [], _loading: false, _error: '', ...extra });

describe('<person-o2o> — los O2O hechos en la ficha', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    deps.createO2OContainer.mockResolvedValue({ persistence: 'p' });
  });

  it('lee los O2O de la persona en la herramienta O2O de su manager', async () => {
    const c = ctx();
    deps.listSessions.mockResolvedValue([{ id: 's1', date: '2026-10-07' }]);
    await _load.call(c);
    expect(deps.createO2OContainer).toHaveBeenCalledWith({ mode: 'firestore', leaderUid: 'manager' });
    expect(deps.listSessions).toHaveBeenCalledWith('p', 'p1');
    expect(c._sessions).toEqual([{ id: 's1', date: '2026-10-07' }]);
  });

  it('sin manager no hay O2O que leer, y se dice', async () => {
    const c = ctx({ leaderUid: null });
    await _load.call(c);
    expect(deps.listSessions).not.toHaveBeenCalled();
    expect(c._error).toMatch(/no tiene manager/);
  });

  it('una respuesta que llega tarde (cambió la persona o su manager) se descarta', async () => {
    const c = ctx();
    let resolve;
    deps.listSessions.mockReturnValueOnce(new Promise((r) => { resolve = r; })).mockResolvedValueOnce([{ id: 'nueva' }]);
    const vieja = _load.call(c);
    c.leaderUid = 'otro';
    await _load.call(c);
    resolve([{ id: 'vieja' }]);
    await vieja;
    expect(c._sessions).toEqual([{ id: 'nueva' }]);
  });

  it('si quien mira no es su manager, se dice de quién son los O2O', async () => {
    const c = ctx();
    deps.listSessions.mockRejectedValue(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    await _load.call(c);
    expect(c._error).toMatch(/solo los ve su manager/);
  });
});
