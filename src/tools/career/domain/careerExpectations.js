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

const SLOT_ACTION = Object.freeze({ first: 'Revisar', second: 'Revisar', arbiter: 'Desempatar' });

/**
 * Qué puede hacer quien mira en una fila (RMR-TSK-0705): el ingeniero marca con
 * evidencia; un revisor revisa lo marcado o marca directamente lo que nadie ha
 * marcado, en su hueco. El árbitro solo desempata.
 * @param {{ status: string, claim: object|null, slot: string|null }} row
 * @param {{ isSelf: boolean, viewerUid: string|null, reviewers: import('./claims.js').Reviewers }} viewer
 * @returns {{ claim: string|null, review: string|null, markSlot: 'first'|'second'|null }}
 */
export function rowActions(row, { isSelf, viewerUid, reviewers }) {
  const claimable = isSelf && (row.status === 'open' || row.status === 'rejected');
  const claimLabel = row.status === 'rejected' ? 'Volver a marcar' : 'Marcar como cumplida';
  const reviewable = !!row.slot && !row.claim?.reviews?.[row.slot];
  let markSlot = null;
  if (!isSelf && viewerUid && row.status === 'open') {
    if (reviewers?.firstUid === viewerUid) markSlot = 'first';
    else if (reviewers?.secondUid === viewerUid) markSlot = 'second';
  }
  return {
    claim: claimable ? claimLabel : null,
    review: reviewable ? SLOT_ACTION[row.slot] : null,
    markSlot,
  };
}

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
