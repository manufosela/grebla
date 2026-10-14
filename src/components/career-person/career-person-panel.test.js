/** <career-person-panel>: guarda, recarga y lo que falla se queda en el diálogo (prototipo sobre un `this` mínimo). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const lib = vi.hoisted(() => ({ listClaims: vi.fn(), submitClaim: vi.fn(), reviewClaim: vi.fn(), markAsReviewer: vi.fn() }));
vi.mock('../../lib/careerClaims.js', () => lib);
const assess = vi.hoisted(() => ({ getLevelAssessment: vi.fn(), saveLevelAssessment: vi.fn() }));
vi.mock('../../lib/careerAssessment.js', () => assess);
const evidence = vi.hoisted(() => ({ listEvidence: vi.fn(), addEvidence: vi.fn() }));
vi.mock('../../lib/careerEvidence.js', () => evidence);
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

  it('cerrar valoración guarda un cierre con el cumplimiento de lo ACEPTADO', async () => {
    const fw = {
      dimensions: [{ id: 'tech', name: 'Técnica', order: 1 }, { id: 'prod', name: 'Producto', order: 2 }],
      expectations: [{ levelId: 'l2', dimensionId: 'tech', text: 'a', weight: 3 }, { levelId: 'l2', dimensionId: 'prod', text: 'b' }],
    };
    const accepted = { levelId: 'l2', dimensionId: 'tech', status: 'claimed', reviews: { first: { decision: 'accept' } } };
    const c = ctx({
      framework: fw, _next: { id: 'l2' }, _assessment: { levelId: 'l2', byDimension: {}, closures: [] }, _claims: [accepted],
      person: { id: 'dev', careerReviewers: { firstUid: 'u-em', secondUid: null } },
    });
    await CareerPersonPanel.prototype._closeAssessment.call(c);
    const [, levelId, saved] = assess.saveLevelAssessment.mock.calls[0];
    expect([levelId, saved.closures.length, saved.closures[0].pct]).toEqual(['l2', 1, 75]);
  });

  it('marcar como revisor guarda la marca directa, no una revisión (RMR-TSK-0705)', async () => {
    const c = ctx({ _dialog: 'review' });
    await _onReviewSubmit.call(c, { detail: {
      mode: 'mark', levelId: 'l2', dimensionId: 'tech', claim: null, slot: 'first', decision: 'accept', reason: 'Lideró el rediseño',
    } });
    expect(lib.markAsReviewer).toHaveBeenCalledWith('dev', {
      levelId: 'l2', dimensionId: 'tech', slot: 'first', decision: 'accept', reason: 'Lideró el rediseño', by: { uid: 'u-dev', name: 'Dev' },
    });
    expect(lib.reviewClaim).not.toHaveBeenCalled();
    expect(c._dialog).toBeNull();
  });

  it('una entrada del historial se añade con su tipo, texto, enlaces y autor (RMR-TSK-0712)', async () => {
    const c = ctx();
    const links = [{ kind: 'pr', url: 'https://x.dev/pr/1' }];
    await _onClaimSubmit.call(c, { detail: {
      mode: 'entry', kind: 'misses', levelId: 'l1', dimensionId: 'tech', evidence: { text: 'Le falta documentar', links },
    } });
    expect(evidence.addEvidence).toHaveBeenCalledWith('dev', {
      levelId: 'l1', dimensionId: 'tech', kind: 'misses', text: 'Le falta documentar', links, by: { uid: 'u-dev', name: 'Dev' },
    });
    expect(lib.submitClaim).not.toHaveBeenCalled();
    expect(c._dialog).toBeNull();
  });

  it('si la entrada no se guarda, el diálogo sigue abierto con el error', async () => {
    evidence.addEvidence.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    const c = ctx();
    await _onClaimSubmit.call(c, { detail: { mode: 'entry', kind: 'meets', levelId: 'l1', dimensionId: 'tech', evidence: { text: 'x', links: [] } } });
    expect([c._dialog, c._busy]).toEqual(['claim', false]);
    expect(c._error).toMatch(/permis/i);
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
