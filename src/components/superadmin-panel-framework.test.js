/**
 * Tests de la lógica del framework de carrera en superadmin-panel (RMR-TSK-0229):
 * alta de nivel pre-asignada a un track y reordenación de niveles DENTRO de su
 * track (no en la lista global). Se ejercitan los métodos reales del prototipo
 * sobre un `this` mínimo, sin montar el componente Lit (que arrastraría Firebase
 * y un DOM): lo que se verifica es la manipulación del modelo, no el render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SuperadminPanel } from './superadmin-panel.js';

const { _addLevel, _moveLevelInTrack, _patchFramework } = SuperadminPanel.prototype;

/** Crea un `this` mínimo con un framework de ejemplo (2 tracks, niveles en cada uno). */
function makeCtx() {
  return {
    _framework: {
      tracks: [
        { id: 'ic', name: 'Individual Contributor', order: 1, description: '' },
        { id: 'tl', name: 'Tech Lead', order: 2, description: '' },
      ],
      levels: [
        { id: 'l1', code: 'L1', title: 'Junior', trackId: 'ic', order: 1, branchesFrom: null },
        { id: 'l2', code: 'L2', title: 'Mid', trackId: 'ic', order: 2, branchesFrom: null },
        { id: 'l3', code: 'L3', title: 'Senior', trackId: 'ic', order: 3, branchesFrom: null },
        { id: 'l4', code: 'L4', title: 'Staff', trackId: 'tl', order: 4, branchesFrom: null },
      ],
    },
    _fwNew: { track: '', discipline: '', dimension: '', levelCode: '', levelTitle: '' },
    _fwError: '',
    _fwNotice: '',
    _patchFramework,
  };
}

/** order de un nivel por id, para comparar reordenaciones. */
const orderOf = (ctx, id) => ctx._framework.levels.find((l) => l.id === id).order;

describe('_addLevel: alta de nivel pre-asignada a un track', () => {
  let ctx;
  beforeEach(() => { ctx = makeCtx(); });

  it('asigna el track indicado cuando existe', () => {
    ctx._fwNew = { ...ctx._fwNew, levelCode: 'L5', levelTitle: 'Principal' };
    _addLevel.call(ctx, 'tl');
    const added = ctx._framework.levels.at(-1);
    expect(added.trackId).toBe('tl');
    expect(added.code).toBe('L5');
    expect(ctx._framework.levels).toHaveLength(5);
  });

  it('cae al primer track si el track indicado no existe', () => {
    ctx._fwNew = { ...ctx._fwNew, levelCode: 'L9', levelTitle: 'Fantasma' };
    _addLevel.call(ctx, 'no-existe');
    expect(ctx._framework.levels.at(-1).trackId).toBe('ic');
  });

  it('no añade nada y marca error si falta código o título', () => {
    ctx._fwNew = { ...ctx._fwNew, levelCode: '', levelTitle: 'Sin código' };
    _addLevel.call(ctx, 'ic');
    expect(ctx._framework.levels).toHaveLength(4);
    expect(ctx._fwError).not.toBe('');
  });
});

describe('_moveLevelInTrack: reordena solo dentro del track', () => {
  let ctx;
  beforeEach(() => { ctx = makeCtx(); });

  it('intercambia el order con el vecino del mismo track', () => {
    const beforeL1 = orderOf(ctx, 'l1');
    const beforeL2 = orderOf(ctx, 'l2');
    _moveLevelInTrack.call(ctx, 'ic', 'l1', 1); // baja L1
    expect(orderOf(ctx, 'l1')).toBe(beforeL2);
    expect(orderOf(ctx, 'l2')).toBe(beforeL1);
  });

  it('nunca toca niveles de otro track (l4 en tl queda intacto)', () => {
    const beforeL4 = orderOf(ctx, 'l4');
    _moveLevelInTrack.call(ctx, 'ic', 'l3', 1); // L3 es el último de ic → no-op
    expect(orderOf(ctx, 'l4')).toBe(beforeL4);
    // el track ic no cambia porque L3 ya es el último
    expect(ctx._framework.levels.filter((l) => l.trackId === 'ic').map((l) => l.id))
      .toEqual(['l1', 'l2', 'l3']);
  });

  it('es no-op en el borde superior', () => {
    const snapshot = ctx._framework.levels.map((l) => [l.id, l.order]);
    _moveLevelInTrack.call(ctx, 'ic', 'l1', -1); // L1 ya es el primero
    expect(ctx._framework.levels.map((l) => [l.id, l.order])).toEqual(snapshot);
  });
});
