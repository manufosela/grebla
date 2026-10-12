/** <career-person-panel>: guarda, recarga y lo que falla se queda en el diálogo (prototipo sobre un `this` mínimo). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ listClaims: vi.fn(), submitClaim: vi.fn(), reviewClaim: vi.fn() }));
vi.mock('../../lib/careerClaims.js', () => lib);
vi.mock('../../lib/careerAssessment.js', () => ({ getLevelAssessment: vi.fn() }));
vi.mock('../../lib/auth.js', () => ({ getCurrentUser: () => ({ uid: 'u-dev', displayName: 'Dev' }) }));

const { CareerPersonPanel } = await import('./career-person-panel.js');
const { _onClaimSubmit, _onReviewSubmit, _load, _save } = CareerPersonPanel.prototype;

const ctx = (extra = {}) => ({
  person: { id: 'dev', levelId: 'l1' }, framework: { levels: [] }, _claims: [], _busy: false, _error: '',
  _dialog: 'claim', _request: null, _next: null, _load, _save, ...extra,
});

describe('<career-person-panel>', () => {
  beforeEach(() => { vi.resetAllMocks(); lib.listClaims.mockResolvedValue([{ id: 'l2__tech' }]); });

  it('marcar guarda con el autor, recarga y cierra el diálogo', async () => {
    const c = ctx();
    const evidence = { text: 'ADR', links: [] };
    await _onClaimSubmit.call(c, { detail: { levelId: 'l2', dimensionId: 'tech', evidence } });
    expect(lib.submitClaim).toHaveBeenCalledWith('dev', { levelId: 'l2', dimensionId: 'tech', evidence, by: { uid: 'u-dev', name: 'Dev' } });
    expect([c._claims, c._dialog, c._busy]).toEqual([[{ id: 'l2__tech' }], null, false]);
  });

  it('si se guarda pero no se puede recargar, el diálogo sigue abierto con el error', async () => {
    lib.listClaims.mockRejectedValue(new Error('Sin permiso'));
    const c = ctx();
    await _onClaimSubmit.call(c, { detail: { levelId: 'l2', dimensionId: 'tech', evidence: { text: 'ADR', links: [] } } });
    expect([c._dialog, c._error, c._claims]).toEqual(['claim', 'Sin permiso', []]);
  });

  it('si la revisión falla, el diálogo sigue abierto con el error', async () => {
    lib.reviewClaim.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    const c = ctx({ _dialog: 'review' });
    await _onReviewSubmit.call(c, { detail: { claim: { id: 'l2__tech' }, slot: 'first', decision: 'accept', reason: '' } });
    expect(c._dialog).toBe('review');
    expect(c._error).toMatch(/permis/i);
    expect(c._busy).toBe(false);
  });
});
