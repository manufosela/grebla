import { describe, it, expect } from 'vitest';
import { claimId, validateEvidence, claimStatus, marksFromClaims, MAX_EVIDENCE_LINKS } from './claims.js';

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
