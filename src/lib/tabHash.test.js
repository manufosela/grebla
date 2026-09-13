/**
 * Tests del ancla → pestaña (RMR-TSK-0499).
 *
 * El que sostiene todo lo demás: un ancla NO da permiso. Quien teclea
 * `#rounds` sin poder gestionar rondas no acaba en rondas — acaba donde le
 * corresponde, y sin enterarse de que existe otra pestaña.
 */
import { describe, it, expect } from 'vitest';
import { tabFromHash } from './tabHash.js';

const VISIBLES = ['play', 'results'];

describe('tabFromHash', () => {
  it('abre la pestaña del ancla cuando es suya', () => {
    expect(tabFromHash('#results', VISIBLES)).toBe('results');
    expect(tabFromHash('results', VISIBLES)).toBe('results');
  });

  it('un ancla de una pestaña que no le toca cae en la primera suya', () => {
    expect(tabFromHash('#rounds', VISIBLES)).toBe('play');
  });

  it('sin ancla, la primera suya', () => {
    for (const h of ['', '#', null, undefined]) expect(tabFromHash(h, VISIBLES)).toBe('play');
  });

  it('respeta el fallback cuando se da', () => {
    expect(tabFromHash('#nada', VISIBLES, 'results')).toBe('results');
  });

  it('acepta pestañas como objetos, que es como las tienen los componentes', () => {
    expect(tabFromHash('#metrics', [{ id: 'teams' }, { id: 'metrics' }])).toBe('metrics');
  });

  it('sin pestañas visibles no inventa ninguna', () => {
    expect(tabFromHash('#results', [])).toBe('');
  });

  it('se queda con la clave del ancla, no con lo que venga detrás', () => {
    // Los hashes con parámetros («#teams=3») los usa el panel de organización.
    expect(tabFromHash('#results=2', VISIBLES)).toBe('results');
  });
});
