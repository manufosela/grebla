import { describe, it, expect } from 'vitest';
import {
  claimId, validateEvidence, claimStatus, marksFromClaims, MAX_EVIDENCE_LINKS,
  newClaim, resubmitted, reviewPatch, slotFor, pendingForReviewer,
} from './claims.js';

const TWO = { firstUid: 'em', secondUid: 'head', arbiterUid: 'cto' };
const claimed = (reviews = {}) => ({ levelId: 'l2', dimensionId: 'tech', status: 'claimed', reviews });
const said = (decision) => ({ decision });

describe('claimId', () => {
  it('une nivel y dimensión: una marca viva por expectativa', () => {
    expect(claimId('l2', 'tech')).toBe('l2__tech');
  });
});

describe('validateEvidence', () => {
  it('exige texto: sin evidencia no se marca', () => {
    expect(() => validateEvidence({ text: '   ' })).toThrow(/evidencia/i);
    expect(() => validateEvidence({ text: {} })).toThrow(/evidencia/i);
  });

  it('recorta el texto y admite enlaces http(s) con su tipo', () => {
    const ok = validateEvidence({ text: '  ADR del cobro  ', links: [{ kind: 'adr', url: 'https://x.dev/adr/1' }] });
    expect(ok).toEqual({ text: 'ADR del cobro', links: [{ kind: 'adr', url: 'https://x.dev/adr/1' }] });
  });

  it('rechaza enlaces que no son http(s) o de un tipo desconocido', () => {
    expect(() => validateEvidence({ text: 'a', links: [{ kind: 'pr', url: 'javascript:alert(1)' }] })).toThrow(/enlace/i);
    expect(() => validateEvidence({ text: 'a', links: [{ kind: 'tweet', url: 'https://x.dev' }] })).toThrow(/tipo/i);
  });

  it('pone tope al texto y al número de enlaces', () => {
    expect(() => validateEvidence({ text: 'a'.repeat(1001) })).toThrow(/1000/);
    const links = Array.from({ length: MAX_EVIDENCE_LINKS + 1 }, () => ({ kind: 'doc', url: 'https://x.dev' }));
    expect(() => validateEvidence({ text: 'a', links })).toThrow(/enlaces/i);
  });
});

describe('claimStatus', () => {
  it('sin marca, o retirada, la expectativa está abierta', () => {
    expect(claimStatus(null, TWO)).toBe('open');
    expect(claimStatus({ ...claimed(), status: 'withdrawn' }, TWO)).toBe('open');
  });

  it('espera a los dos revisores', () => {
    expect(claimStatus(claimed(), TWO)).toBe('pending');
    expect(claimStatus(claimed({ first: said('accept') }), TWO)).toBe('pending');
  });

  it('cuenta cuando los dos coinciden', () => {
    expect(claimStatus(claimed({ first: said('accept'), second: said('accept') }), TWO)).toBe('accepted');
    expect(claimStatus(claimed({ first: said('reject'), second: said('reject') }), TWO)).toBe('rejected');
  });

  it('si discrepan es empate hasta que decide el árbitro', () => {
    const tie = { first: said('accept'), second: said('reject') };
    expect(claimStatus(claimed(tie), TWO)).toBe('tie');
    expect(claimStatus(claimed({ ...tie, arbiter: said('accept') }), TWO)).toBe('accepted');
  });

  it('si el árbitro ya es revisor, su decisión desempata', () => {
    const emReviewers = { firstUid: 'head', secondUid: 'cto', arbiterUid: 'cto' };
    expect(claimStatus(claimed({ first: said('accept'), second: said('reject') }), emReviewers)).toBe('rejected');
  });

  it('con un solo revisor basta su decisión', () => {
    const solo = { firstUid: 'cto', secondUid: null, arbiterUid: null };
    expect(claimStatus(claimed({ first: said('accept') }), solo)).toBe('accepted');
  });
});

describe('marksFromClaims', () => {
  it('solo marca lo aceptado del nivel pedido', () => {
    const claims = [
      claimed({ first: said('accept'), second: said('accept') }),
      { ...claimed({ first: said('accept') }), dimensionId: 'product' },
      { ...claimed({ first: said('accept'), second: said('accept') }), levelId: 'l3', dimensionId: 'culture' },
    ];
    expect(marksFromClaims(claims, 'l2', TWO)).toEqual({ tech: true });
  });
});

const BY = { uid: 'u-dev', name: 'Dev' };
const EV = { text: 'ADR del cobro', links: [] };

describe('newClaim y resubmitted: lo que escribe el ingeniero', () => {
  it('una marca nueva va sin revisiones ni historial', () => {
    expect(newClaim({ levelId: 'l2', dimensionId: 'tech', evidence: EV, by: BY, at: 't1' })).toEqual({
      levelId: 'l2', dimensionId: 'tech', status: 'claimed', evidence: EV,
      claimedBy: BY, claimedAt: 't1', reviews: {}, history: [], updatedAt: 't1',
    });
  });

  it('reenviar archiva la ronda anterior y vacía las revisiones', () => {
    const current = { ...claimed({ first: said('reject') }), evidence: EV, history: [] };
    const next = { text: 'Ahora con el ADR enlazado', links: [] };
    expect(resubmitted(current, { evidence: next, at: 't2' })).toEqual({
      evidence: next, status: 'claimed', claimedAt: 't2', reviews: {}, updatedAt: 't2',
      history: [{ evidence: EV, reviews: { first: said('reject') } }],
    });
  });

  it('retirar también archiva la ronda y deja la expectativa abierta', () => {
    const current = { ...claimed(), evidence: EV, history: [] };
    expect(resubmitted(current, { evidence: EV, at: 't3', status: 'withdrawn' }).status).toBe('withdrawn');
  });
});

describe('pendingForReviewer: lo que me toca revisar', () => {
  it('cuenta las marcas vivas en las que mi revisión falta, y los empates si arbitro', () => {
    const claims = [
      claimed(),
      { ...claimed({ first: said('accept') }), dimensionId: 'product' },
      { ...claimed(), status: 'withdrawn', dimensionId: 'culture' },
      { ...claimed({ first: said('accept'), second: said('reject') }), dimensionId: 'execution' },
    ];
    expect(pendingForReviewer(claims, TWO, 'em')).toBe(1);
    expect(pendingForReviewer(claims, TWO, 'head')).toBe(2);
    expect(pendingForReviewer(claims, TWO, 'cto')).toBe(1);
    expect(pendingForReviewer(claims, TWO, 'otro')).toBe(0);
  });
});

describe('reviewPatch y slotFor: lo que escribe cada revisor', () => {
  it('rechazar exige motivo; aceptar no', () => {
    expect(() => reviewPatch('first', { decision: 'reject', reason: ' ', by: BY, at: 't' })).toThrow(/motivo/i);
    expect(reviewPatch('first', { decision: 'accept', by: BY, at: 't' })).toEqual({
      'reviews.first': { decision: 'accept', reason: '', by: BY, at: 't' }, updatedAt: 't',
    });
  });

  it('a cada revisor le toca su hueco; al árbitro solo con empate', () => {
    expect(slotFor(TWO, 'em', claimed())).toBe('first');
    expect(slotFor(TWO, 'head', claimed())).toBe('second');
    expect(slotFor(TWO, 'cto', claimed())).toBeNull();
    expect(slotFor(TWO, 'cto', claimed({ first: said('accept'), second: said('reject') }))).toBe('arbiter');
    expect(slotFor(TWO, 'otro', claimed())).toBeNull();
  });
});
