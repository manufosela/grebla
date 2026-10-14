/**
 * <career-review-dialog>: sin motivo no sale ni aceptar ni rechazar, y el evento
 * lleva el hueco del revisor. Métodos reales del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect, vi } from 'vitest';

const { CareerReviewDialog } = await import('./career-review-dialog.js');
const { _decide } = CareerReviewDialog.prototype;

const ctx = (extra = {}) => ({
  request: { claim: { id: 'l2__tech' }, slot: 'first', text: 'Decide arquitectura' },
  _reason: '', _invalid: '', dispatchEvent: vi.fn(), ...extra,
});

describe('<career-review-dialog>', () => {
  it('rechazar sin motivo no sale y dice por qué', () => {
    const c = ctx();
    _decide.call(c, 'reject');
    expect(c.dispatchEvent).not.toHaveBeenCalled();
    expect(c._invalid).toMatch(/motivo/i);
  });

  it('aceptar sin motivo tampoco sale (RMR-TSK-0703)', () => {
    const c = ctx({ _reason: '  ' });
    _decide.call(c, 'accept');
    expect(c.dispatchEvent).not.toHaveBeenCalled();
    expect(c._invalid).toMatch(/motivo/i);
  });

  it('aceptar sale con el hueco y la decisión', () => {
    const c = ctx({ _reason: ' Visto en el ADR ' });
    _decide.call(c, 'accept');
    const event = c.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('review-submit');
    expect(event.detail).toMatchObject({ slot: 'first', decision: 'accept', reason: 'Visto en el ADR' });
  });
});
