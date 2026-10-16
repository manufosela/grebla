/**
 * <o2o-actions> con persona fija (RMR-TSK-0728): en la ficha no hay selector y
 * se cargan sus acciones directamente. Métodos reales del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect, vi } from 'vitest';

const usecases = vi.hoisted(() => ({ listActions: vi.fn(), createAction: vi.fn(), toggleAction: vi.fn(), removeAction: vi.fn() }));
vi.mock('../../tools/o2o/application/usecases/actions.js', () => usecases);

const { O2OActions } = await import('./o2o-actions.js');
const { updated, _selectPerson, _reload, _renderPicker } = O2OActions.prototype;

describe('<o2o-actions> con persona fija', () => {
  it('al recibir la persona carga sus acciones, sin elegirla', async () => {
    usecases.listActions.mockResolvedValue([{ id: 'a1', description: 'Leer el ADR' }]);
    const c = { persistence: {}, personId: 'dev', periodId: null, _selectPerson, _reload };
    await updated.call(c, new Map([['personId', null]]));
    await vi.waitFor(() => expect(c._actions).toEqual([{ id: 'a1', description: 'Leer el ADR' }]));
    expect(usecases.listActions).toHaveBeenCalledWith({}, 'dev');
  });

  it('con persona fija no pinta el selector', () => {
    expect(_renderPicker.call({ personId: 'dev', people: [] })).toBeNull();
  });
});
