/**
 * Filas de «Expectativas» de Mi carrera (RMR-TSK-0679). Dominio PURO: une cada
 * expectativa del nivel siguiente con la marca del ingeniero, su estado y el
 * hueco de revisión que le toca a quien está mirando.
 */
import { expectationsForLevel, expectationWeight } from '../data/framework.js';
import { claimStatus, slotFor } from './claims.js';

/** Cómo se dice cada estado a la persona. */
export const STATUS_LABEL = Object.freeze({
  open: 'Sin marcar',
  pending: 'Pendiente de revisión',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  tie: 'Pendiente de desempate',
});

/**
 * @param {{ framework: object, levelId: string, claims: Array<object>,
 *   reviewers: import('./claims.js').Reviewers, viewerUid: string|null }} input
 */
export function expectationRows({ framework, levelId, claims, reviewers, viewerUid }) {
  const cells = framework?.expectations ?? [];
  return expectationsForLevel(framework, levelId)
    .filter((row) => row.text !== '')
    .map((row) => {
      const cell = cells.find((e) => e.levelId === levelId && e.dimensionId === row.dimension.id);
      const claim = (claims ?? []).find((c) => c.levelId === levelId && c.dimensionId === row.dimension.id) ?? null;
      const status = claimStatus(claim, reviewers);
      return {
        dimension: { id: row.dimension.id, name: row.dimension.name },
        text: row.text,
        weight: expectationWeight(cell),
        core: cell?.core === true,
        status,
        claim,
        slot: status === 'open' ? null : slotFor(reviewers, viewerUid, claim),
      };
    });
}
