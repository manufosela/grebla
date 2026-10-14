import { describe, it, expect } from 'vitest';
import { levelPath } from './levelPath.js';
import { seedFramework } from '../data/framework.js';

const fw = seedFramework();
const path = (levelId) => levelPath(fw, levelId).map((s) => `${s.level.id}:${s.state}`);

describe('levelPath: las pestañas de nivel de una persona (RMR-TSK-0702)', () => {
  it('un IC ve su camino entero, con los inferiores, el actual y los superiores', () => {
    expect(path('l2')).toEqual(['l1:below', 'l2:current', 'l3:above', 'l4:above', 'l5:above']);
  });

  it('un Tech Lead ve los niveles IC anteriores a su rama y después los de su track', () => {
    // L3-TL ramifica desde L3: el camino pasa por L1 y L2 y sigue por TL.
    expect(path('l4tl')).toEqual(['l1:below', 'l2:below', 'l3tl:below', 'l4tl:current', 'l5tl:above']);
  });

  it('un EM igual, por su track: no ve los niveles de TL ni los IC de su altura', () => {
    expect(path('l3em')).toEqual(['l1:below', 'l2:below', 'l3em:current', 'l4em:above', 'l5em:above']);
  });

  it('cada paso lleva el nivel completo para pintar la pestaña', () => {
    const [first] = levelPath(fw, 'l2');
    expect(first.level).toMatchObject({ id: 'l1', code: 'L1', title: 'Engineer' });
  });

  it('sin nivel asignado, o con uno que no existe, no hay pestañas', () => {
    expect(levelPath(fw, null)).toEqual([]);
    expect(levelPath(fw, 'l9')).toEqual([]);
    expect(levelPath(null, 'l2')).toEqual([]);
  });

  it('un track sin rama declarada no arrastra niveles de otro', () => {
    const solo = { levels: [
      { id: 'a1', code: 'A1', trackId: 'a', order: 1 },
      { id: 'a2', code: 'A2', trackId: 'a', order: 2 },
      { id: 'b1', code: 'B1', trackId: 'b', order: 1 },
    ] };
    expect(levelPath(solo, 'b1').map((s) => s.level.id)).toEqual(['b1']);
  });
});
