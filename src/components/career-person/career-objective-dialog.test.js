/**
 * <career-objective-dialog>: un objetivo sin cómo se mide no sale; al cerrar
 * hay que elegir cómo acabó. Métodos reales del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect, vi } from 'vitest';

const { CareerObjectiveDialog } = await import('./career-objective-dialog.js');
const { _submit } = CareerObjectiveDialog.prototype;

const ctx = (extra = {}) => ({
  request: { mode: 'new', levelId: 'l2', options: [{ dimensionId: 'tech', name: 'Técnica' }] },
  _title: '', _measure: '', _due: '', _dimensionId: '', _status: '', _note: '', _invalid: '',
  dispatchEvent: vi.fn(), ...extra,
});

describe('<career-objective-dialog>', () => {
  it('sin cómo se mide no sale y dice por qué', () => {
    const c = ctx({ _title: 'Medir la IA' });
    _submit.call(c);
    expect(c.dispatchEvent).not.toHaveBeenCalled();
    expect(c._invalid).toMatch(/cómo se mide/);
  });

  it('sale con la expectativa elegida y su nivel', () => {
    const c = ctx({ _title: ' Medir la IA ', _measure: 'Ahorro ≥ 20 %', _due: '2026-12-31', _dimensionId: 'tech' });
    _submit.call(c);
    const event = c.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('objective-submit');
    expect(event.detail).toEqual({ mode: 'new', title: 'Medir la IA', measure: 'Ahorro ≥ 20 %', dueDate: '2026-12-31',
      levelId: 'l2', dimensionId: 'tech' });
  });

  it('suelto, sin expectativa ni fecha', () => {
    const c = ctx({ _title: 'Medir la IA', _measure: 'Ahorro ≥ 20 %' });
    _submit.call(c);
    expect(c.dispatchEvent.mock.calls[0][0].detail).toMatchObject({ dueDate: null, levelId: null, dimensionId: null });
  });

  it('al cerrar hay que decir cómo acabó', () => {
    const request = { mode: 'close', objective: { id: 'o1', title: 'Medir la IA' } };
    const sin = ctx({ request });
    _submit.call(sin);
    expect(sin._invalid).toMatch(/cómo acabó/);
    const sinNota = ctx({ request, _status: 'achieved', _note: '  ' });
    _submit.call(sinNota);
    expect(sinNota.dispatchEvent).not.toHaveBeenCalled();
    expect(sinNota._invalid).toMatch(/lo medido/);
    const con = ctx({ request, _status: 'achieved', _note: ' Medido: 23 % ' });
    _submit.call(con);
    expect(con.dispatchEvent.mock.calls[0][0].detail).toEqual({ mode: 'close', objectiveId: 'o1', status: 'achieved', note: 'Medido: 23 %' });
  });
});
