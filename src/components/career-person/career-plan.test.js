/** <career-plan>: guarda el borrador normalizado y lo que falla se queda en pantalla (prototipo sobre un `this` mínimo). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ getCareerPlan: vi.fn(), saveCareerPlan: vi.fn() }));
vi.mock('../../lib/careerPlan.js', () => lib);
vi.mock('../../lib/auth.js', () => ({ getCurrentUser: () => ({ uid: 'u-em', displayName: 'EM' }) }));

const { CareerPlan } = await import('./career-plan.js');
const { _save, canEdit } = { _save: CareerPlan.prototype._save, canEdit: Object.getOwnPropertyDescriptor(CareerPlan.prototype, '_canEdit').get };

const ctx = (extra = {}) => ({
  person: { id: 'dev', uid: 'u-dev', directoryManagerUids: ['u-em'] }, _plan: null, _editing: true, _busy: false, _error: '',
  _draft: { focus: ' Backend al 4 de diciembre ', responsibilities: 'Ownership de backend\n\nDelegar', lettingGo: 'Postmortems' }, ...extra,
});

describe('<career-plan>', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('guarda una línea por responsabilidad, con el autor, y sale de edición', async () => {
    const c = ctx();
    await _save.call(c);
    expect(lib.saveCareerPlan).toHaveBeenCalledWith('dev', {
      focus: ' Backend al 4 de diciembre ', responsibilities: ['Ownership de backend', '', 'Delegar'], lettingGo: ['Postmortems'],
    }, { uid: 'u-em', name: 'EM' });
    expect([c._editing, c._busy, c._plan.responsibilities]).toEqual([false, false, ['Ownership de backend', 'Delegar']]);
  });

  it('si no se puede guardar, sigue editando con el error', async () => {
    lib.saveCareerPlan.mockRejectedValue(new Error('Sin permiso'));
    const c = ctx();
    await _save.call(c);
    expect([c._editing, c._error]).toEqual([true, 'Sin permiso']);
  });

  it('al cambiar de persona se descarta el borrador: no se guarda en la nueva', () => {
    lib.getCareerPlan.mockResolvedValue({ focus: '', responsibilities: [], lettingGo: [] });
    const c = ctx({ person: { id: 'otra' } });
    CareerPlan.prototype.updated.call(c, new Map([['person', { id: 'dev' }]]));
    expect([c._editing, c._draft]).toEqual([false, null]);
  });

  it('edita su cadena; la propia persona solo lee', () => {
    expect(canEdit.call(ctx())).toBe(true);
    expect(canEdit.call(ctx({ person: { id: 'dev', uid: 'u-em', directoryManagerUids: ['u-em'] } }))).toBe(false);
  });
});
