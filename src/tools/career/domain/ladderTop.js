/**
 * ¿Está la persona en el tope de su vía? (RMR-TSK-0761). El CTO (L6-M) no
 * tiene nivel por encima en su itinerario: no tiene sentido enseñarle avance ni
 * aspiraciones hacia otro nivel. Se le valora por las expectativas de su nivel y
 * por sus objetivos. PURO.
 */
import { nextLevelFor } from './subLevel.js';

/**
 * @param {ReadonlyArray<{ id: string, trackId: string, order: number }>} levels
 * @param {string|null|undefined} levelId
 * @returns {boolean}
 */
export function atTopOfLadder(levels, levelId) {
  const known = (levels ?? []).some((l) => l.id === levelId);
  return known && !nextLevelFor(levels, levelId);
}
