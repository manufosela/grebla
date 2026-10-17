import { describe, it, expect } from 'vitest';
import { atTopOfLadder } from './ladderTop.js';

/**
 * Un Head (L5-EM) no tiene a dónde subir en su vía (RMR-TSK-0761): no se le
 * enseña avance hacia otro nivel; se le valora por las expectativas de su nivel
 * y por sus objetivos.
 */
const LEVELS = [
  { id: 'l4em', trackId: 'em', order: 4 },
  { id: 'l5em', trackId: 'em', order: 5 },
  { id: 'l5', trackId: 'ic', order: 5 },
];

describe('atTopOfLadder', () => {
  it('el último nivel de su vía es el tope', () => {
    expect(atTopOfLadder(LEVELS, 'l5em')).toBe(true);
    expect(atTopOfLadder(LEVELS, 'l5')).toBe(true);
  });

  it('con un nivel por encima, no', () => {
    expect(atTopOfLadder(LEVELS, 'l4em')).toBe(false);
  });

  it('sin nivel asignado no se sabe: no es tope', () => {
    expect(atTopOfLadder(LEVELS, null)).toBe(false);
    expect(atTopOfLadder(LEVELS, 'inventado')).toBe(false);
  });
});
