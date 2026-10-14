import { describe, it, expect } from 'vitest';
import { expectationRows, STATUS_LABEL, rowActions } from './careerExpectations.js';

const fw = {
  dimensions: [{ id: 'tech', name: 'Technical Excellence', order: 1 }, { id: 'culture', name: 'Cultural Contribution', order: 2 }],
  expectations: [
    { levelId: 'l2', dimensionId: 'tech', text: 'Decide arquitectura', weight: 2, core: true },
    { levelId: 'l2', dimensionId: 'culture', text: '' },
  ],
};
const REVIEWERS = { firstUid: 'em', secondUid: 'head', arbiterUid: 'cto' };
const claim = { id: 'l2__tech', levelId: 'l2', dimensionId: 'tech', status: 'claimed', reviews: { first: { decision: 'accept' } } };

describe('expectationRows', () => {
  it('una fila por expectativa escrita, con su peso, si es imprescindible y su estado', () => {
    const [row, ...rest] = expectationRows({ framework: fw, levelId: 'l2', claims: [claim], reviewers: REVIEWERS, viewerUid: 'em' });
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      dimension: { id: 'tech', name: 'Technical Excellence' }, text: 'Decide arquitectura',
      weight: 2, core: true, status: 'pending', claim, slot: 'first',
    });
  });

  it('sin marca, la expectativa está abierta y a nadie le toca revisar', () => {
    const [row] = expectationRows({ framework: fw, levelId: 'l2', claims: [], reviewers: REVIEWERS, viewerUid: 'em' });
    expect(row).toMatchObject({ status: 'open', claim: null, slot: null });
  });

  it('cada estado tiene su etiqueta para la persona', () => {
    expect(Object.keys(STATUS_LABEL).toSorted()).toEqual(['accepted', 'open', 'pending', 'rejected', 'tie']);
  });
});

describe('rowActions: qué puede hacer quien mira (RMR-TSK-0705)', () => {
  const open = { status: 'open', claim: null, slot: null };
  const pendingMine = { status: 'pending', claim: { reviews: {} }, slot: 'first' };

  it('el ingeniero marca lo abierto y vuelve a marcar lo rechazado', () => {
    expect(rowActions(open, { isSelf: true, viewerUid: 'dev', reviewers: REVIEWERS })).toEqual({ claim: 'Marcar como cumplida', review: null, markSlot: null });
    expect(rowActions({ ...open, status: 'rejected' }, { isSelf: true, viewerUid: 'dev', reviewers: REVIEWERS }).claim).toBe('Volver a marcar');
  });

  it('un revisor marca directamente lo que nadie ha marcado, en su hueco', () => {
    expect(rowActions(open, { isSelf: false, viewerUid: 'em', reviewers: REVIEWERS })).toEqual({ claim: null, review: null, markSlot: 'first' });
    expect(rowActions(open, { isSelf: false, viewerUid: 'head', reviewers: REVIEWERS }).markSlot).toBe('second');
  });

  it('el árbitro y quien no revisa no marcan', () => {
    expect(rowActions(open, { isSelf: false, viewerUid: 'cto', reviewers: REVIEWERS }).markSlot).toBeNull();
    expect(rowActions(open, { isSelf: false, viewerUid: 'otro', reviewers: REVIEWERS }).markSlot).toBeNull();
  });

  it('lo ya marcado se revisa, no se vuelve a marcar', () => {
    expect(rowActions(pendingMine, { isSelf: false, viewerUid: 'em', reviewers: REVIEWERS })).toEqual({ claim: null, review: 'Revisar', markSlot: null });
    const done = { ...pendingMine, claim: { reviews: { first: { decision: 'accept' } } } };
    expect(rowActions(done, { isSelf: false, viewerUid: 'em', reviewers: REVIEWERS }).review).toBeNull();
    expect(rowActions({ ...pendingMine, slot: 'arbiter' }, { isSelf: false, viewerUid: 'cto', reviewers: REVIEWERS }).review).toBe('Desempatar');
  });
});
