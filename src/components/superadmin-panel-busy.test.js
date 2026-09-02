/**
 * Tests del bloqueo de DOM en las escrituras del panel (RMR-BUG-0100).
 *
 * La norma del proyecto es que toda escritura bloquee la pantalla mientras dura:
 * si no, se puede pulsar dos veces y crear la persona dos veces. El panel tenía
 * un overlay que **nadie activaba** desde que la pestaña Usuarios pasó a la
 * tabla de Personas — existía en el render y no se mostraba nunca.
 *
 * Se ejercitan los métodos reales del prototipo sobre un `this` mínimo, como en
 * superadmin-panel-framework.test.js: lo que se verifica es que el overlay se
 * pone y —sobre todo— que se retira pase lo que pase.
 */
import { describe, it, expect, vi } from 'vitest';
import { SuperadminPanel } from './superadmin-panel.js';

const { _withBusy } = SuperadminPanel.prototype;

describe('_withBusy — el overlay se retira pase lo que pase', () => {
  it('muestra el mensaje mientras dura la escritura y lo quita al terminar', async () => {
    const ctx = { _busy: null };
    let visto = null;
    await _withBusy.call(ctx, 'Guardando…', async () => { visto = ctx._busy; });
    expect(visto).toBe('Guardando…');
    expect(ctx._busy).toBeNull();
  });

  it('lo quita también si la escritura falla: si no, la pantalla queda bloqueada', async () => {
    const ctx = { _busy: null };
    await expect(_withBusy.call(ctx, 'Guardando…', async () => { throw new Error('Firestore dijo que no'); }))
      .rejects.toThrow('Firestore dijo que no');
    expect(ctx._busy).toBeNull();
  });

  it('devuelve lo que devuelva la acción, sin tragárselo', async () => {
    const ctx = { _busy: null };
    expect(await _withBusy.call(ctx, 'Guardando…', async () => 'hecho')).toBe('hecho');
  });
});

describe('las escrituras de la tabla de Personas pasan por el overlay', () => {
  /** Cada acción que toca Firestore, con el mensaje que enseña mientras. */
  const WRITES = [
    ['_addPersonPanel', []],
    ['_removePerson', ['person-1']],
    ['_setPersonSuperior', ['person-1', 'person-2']],
    ['_setPersonRole', ['person-1', 'role-1']],
    ['_setPersonBranch', ['person-1', 'branch-1']],
    ['_setGovernance', [{ id: 'person-1', uid: 'uid-1' }, 'viewer']],
    ['_createPersonForAccount', [{ uid: 'uid-1' }]],
  ];

  it.each(WRITES)('%s bloquea el DOM mientras escribe', async (method, args) => {
    const _withBusySpy = vi.fn(async (_message, action) => action());
    const ctx = {
      _withBusy: _withBusySpy,
      [`${method}Impl`]: vi.fn(async () => {}),
    };
    await SuperadminPanel.prototype[method].apply(ctx, args);
    expect(_withBusySpy).toHaveBeenCalledTimes(1);
    const [message] = _withBusySpy.mock.calls[0];
    expect(message, `${method} debe decir qué está haciendo`).toMatch(/\S/);
    expect(ctx[`${method}Impl`]).toHaveBeenCalledTimes(1);
  });
});
