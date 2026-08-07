import { describe, it, expect } from 'vitest';
import { diffSessions, normalizeProposal } from './rmProposal.js';

describe('diffSessions — qué propone el ingeniero distinto del manager (RMR-PCS-0036)', () => {
  it('devuelve solo las respuestas que difieren, con ambos valores', () => {
    const canonical = { q1: 3, q2: 5, q3: 'a' };
    const proposed = { q1: 4, q2: 5, q3: 'b' };
    expect(diffSessions(canonical, proposed)).toEqual([
      { itemId: 'q1', managerValue: 3, proposedValue: 4 },
      { itemId: 'q3', managerValue: 'a', proposedValue: 'b' },
    ]);
  });

  it('una respuesta nueva del ingeniero (el manager no contestó) y una retirada', () => {
    const diffs = diffSessions({ q1: 2 }, { q2: 5 });
    expect(diffs).toEqual([
      { itemId: 'q1', managerValue: 2, proposedValue: null },
      { itemId: 'q2', managerValue: null, proposedValue: 5 },
    ]);
  });

  it('null y undefined cuentan como sin respuesta (no generan diff entre sí)', () => {
    expect(diffSessions({ q1: null }, {})).toEqual([]);
    expect(diffSessions({}, { q1: undefined })).toEqual([]);
  });

  it('arrays (multiselección) se comparan por contenido, no por referencia', () => {
    expect(diffSessions({ q1: ['a', 'b'] }, { q1: ['a', 'b'] })).toEqual([]);
    expect(diffSessions({ q1: ['a'] }, { q1: ['a', 'b'] })).toEqual([
      { itemId: 'q1', managerValue: ['a'], proposedValue: ['a', 'b'] },
    ]);
  });

  it('sin nada que comparar devuelve lista vacía; el orden sigue el mapa canónico primero', () => {
    expect(diffSessions(null, null)).toEqual([]);
    const diffs = diffSessions({ b: 1, a: 1 }, { a: 2, c: 3 });
    expect(diffs.map((d) => d.itemId)).toEqual(['b', 'a', 'c']);
  });
});

describe('normalizeProposal — lectura tolerante del doc', () => {
  it('doc válido pasa con defaults; basura → null', () => {
    const p = normalizeProposal({ answers: { q1: 2 }, targetRole: 'lead', status: 'open', by: { uid: 'u1', name: 'Ana' } });
    expect(p).toEqual({ answers: { q1: 2 }, targetRole: 'lead', status: 'open', by: { uid: 'u1', name: 'Ana' } });
    expect(normalizeProposal(null)).toBe(null);
    expect(normalizeProposal('x')).toBe(null);
  });

  it('answers ausente → {}; status desconocido → open; by tolerante', () => {
    const p = normalizeProposal({ status: 'rarísimo' });
    expect(p).toEqual({ answers: {}, targetRole: null, status: 'open', by: { uid: null, name: null } });
  });

  it('conserva los estados de decisión de F2 (approved/rejected)', () => {
    expect(normalizeProposal({ status: 'approved' }).status).toBe('approved');
    expect(normalizeProposal({ status: 'rejected' }).status).toBe('rejected');
  });
});
