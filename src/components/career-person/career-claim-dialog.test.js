/**
 * <career-claim-dialog>: sin evidencia no se envía; con ella, sale `claim-submit`
 * con la evidencia limpia. Métodos reales del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect, vi } from 'vitest';

const { CareerClaimDialog } = await import('./career-claim-dialog.js');
const { _submit } = CareerClaimDialog.prototype;

const ctx = (extra = {}) => ({
  request: { levelId: 'l2', dimensionId: 'tech', text: 'Decide arquitectura' },
  _text: '', _links: [], _invalid: '', dispatchEvent: vi.fn(), ...extra,
});

describe('<career-claim-dialog>', () => {
  it('sin evidencia no envía y dice por qué', () => {
    const c = ctx();
    _submit.call(c);
    expect(c.dispatchEvent).not.toHaveBeenCalled();
    expect(c._invalid).toMatch(/evidencia/i);
  });

  it('con evidencia envía la marca y descarta los enlaces vacíos', () => {
    const c = ctx({ _text: ' ADR del cobro ', _links: [{ kind: 'adr', url: 'https://x.dev/7' }, { kind: 'pr', url: '  ' }] });
    _submit.call(c);
    const event = c.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('claim-submit');
    expect(event.detail).toMatchObject({
      dimensionId: 'tech', evidence: { text: 'ADR del cobro', links: [{ kind: 'adr', url: 'https://x.dev/7' }] },
    });
  });

  it('en modo entrada sale el tipo elegido con la evidencia (RMR-TSK-0711)', () => {
    const c = ctx({ request: { mode: 'entry', kinds: ['meets', 'misses', 'proof'], levelId: 'l2', dimensionId: 'tech' },
      _kind: 'misses', _text: 'Sus PR necesitan rondas' });
    _submit.call(c);
    expect(c.dispatchEvent.mock.calls[0][0].detail).toMatchObject({ kind: 'misses', evidence: { text: 'Sus PR necesitan rondas' } });
  });

  it('en modo entrada no sale sin tipo, ni con uno que no le toca a quien escribe', () => {
    const sinTipo = ctx({ request: { mode: 'entry', kinds: ['meets', 'misses', 'proof'] }, _kind: '', _text: 'x' });
    _submit.call(sinTipo);
    expect(sinTipo.dispatchEvent).not.toHaveBeenCalled();
    expect(sinTipo._invalid).toMatch(/tipo/i);
    const ingeniero = ctx({ request: { mode: 'entry', kinds: ['proof'] }, _kind: 'meets', _text: 'x' });
    _submit.call(ingeniero);
    expect(ingeniero.dispatchEvent).not.toHaveBeenCalled();
  });
});
