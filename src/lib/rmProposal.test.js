import { describe, it, expect } from 'vitest';
import { applyAccepted, diffSessions, normalizeProposal } from './rmProposal.js';

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

describe('applyAccepted — fusionar en la canónica solo lo aceptado', () => {
  const canonical = { q1: 3, q2: 5, q3: 'a' };
  const diffs = [
    { itemId: 'q1', managerValue: 3, proposedValue: 4 },
    { itemId: 'q3', managerValue: 'a', proposedValue: 'b' },
    { itemId: 'q4', managerValue: null, proposedValue: 2 },
  ];

  it('aplica los aceptados y respeta el resto de la canónica', () => {
    const merged = applyAccepted(canonical, diffs, ['q1', 'q4']);
    expect(merged).toEqual({ q1: 4, q2: 5, q3: 'a', q4: 2 });
    expect(canonical.q1).toBe(3);
  });

  it('un propuesto null aceptado RETIRA la respuesta de la canónica', () => {
    const merged = applyAccepted({ q1: 2 }, [{ itemId: 'q1', managerValue: 2, proposedValue: null }], ['q1']);
    expect('q1' in merged).toBe(false);
  });

  it('sin aceptados devuelve la canónica intacta (copia)', () => {
    const merged = applyAccepted(canonical, diffs, []);
    expect(merged).toEqual(canonical);
    expect(merged).not.toBe(canonical);
  });
});
