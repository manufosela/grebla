import { describe, it, expect } from 'vitest';
import { newEntry, expectationState, timelineFor, ENTRY_KINDS, entryKindsFor, entriesFromLegacyAssessment } from './evidence.js';

describe('entriesFromLegacyAssessment: las valoraciones con nota pasan al historial (RMR-TSK-0713)', () => {
  const by = { uid: 'em', name: 'EM' };
  const at = '2026-10-01T08:00:00.000Z';

  it('«no llega» siempre; «cumple» solo si tenía nota (sin ella no aporta nada al historial)', () => {
    const byDimension = {
      tech: { meets: false, note: 'Sus PR necesitan rondas' },
      product: { meets: false, note: '' },
      culture: { meets: true, note: 'Cuida el listón' },
      reliability: { meets: true, note: '' },
    };
    const entries = entriesFromLegacyAssessment({ byDimension }, { levelId: 'l2', by, at });
    expect(entries.map((e) => [e.id, e.kind])).toEqual([['legacy-tech', 'misses'], ['legacy-product', 'misses'], ['legacy-culture', 'meets']]);
    expect(entries[0].entry).toEqual({ levelId: 'l2', dimensionId: 'tech', kind: 'misses', text: 'Sus PR necesitan rondas', links: [], by, at });
    expect(entries[1].entry.text).toMatch(/sin motivo/i);
  });

  it('sin valoración o sin nivel no hay nada que migrar', () => {
    expect(entriesFromLegacyAssessment(null, { levelId: 'l2', by, at })).toEqual([]);
    expect(entriesFromLegacyAssessment({ byDimension: { tech: { meets: false } } }, { levelId: null, by, at })).toEqual([]);
  });
});

describe('entryKindsFor: qué puede añadir quien mira (RMR-TSK-0712)', () => {
  it('quien lleva a la persona añade cualquier tipo; la persona, pruebas; el resto, nada', () => {
    expect(entryKindsFor({ isSelf: false, leads: true })).toEqual(['meets', 'misses', 'proof']);
    expect(entryKindsFor({ isSelf: true, leads: false })).toEqual(['proof']);
    expect(entryKindsFor({ isSelf: true, leads: true })).toEqual(['proof']);
    expect(entryKindsFor({ isSelf: false, leads: false })).toEqual([]);
  });
});

const EM = { uid: 'em', name: 'EM' };
const DEV = { uid: 'dev', name: 'Dev' };
const entry = (kind, at, extra = {}) => ({ levelId: 'l2', dimensionId: 'tech', kind, text: kind, links: [], by: EM, at, ...extra });

describe('newEntry: una entrada del historial de una expectativa (RMR-TSK-0709)', () => {
  it('lleva tipo, texto, enlaces, quién y cuándo', () => {
    expect(newEntry({ levelId: 'l2', dimensionId: 'tech', kind: 'misses', text: ' Sus PR necesitan rondas ', links: [{ kind: 'pr', url: 'https://x.dev/pr/1' }], by: EM, at: '2026-10-14T09:00:00Z' }))
      .toEqual({ levelId: 'l2', dimensionId: 'tech', kind: 'misses', text: 'Sus PR necesitan rondas', links: [{ kind: 'pr', url: 'https://x.dev/pr/1' }], by: EM, at: '2026-10-14T09:00:00.000Z' });
  });

  it('sin autor completo no hay entrada', () => {
    const base = { levelId: 'l2', dimensionId: 'tech', kind: 'proof', text: 'x', at: '2026-10-14T09:00:00Z' };
    expect(() => newEntry({ ...base, by: undefined })).toThrow(/autor/i);
    expect(() => newEntry({ ...base, by: { uid: 'em', name: ' ' } })).toThrow(/autor/i);
    expect(() => newEntry({ ...base, by: { uid: '', name: 'EM' } })).toThrow(/autor/i);
  });

  it('la fecha es ISO 8601 en UTC: el orden del historial depende de ella', () => {
    const base = { levelId: 'l2', dimensionId: 'tech', kind: 'proof', text: 'x', by: EM };
    expect(() => newEntry({ ...base, at: 't' })).toThrow(/fecha/i);
    expect(() => newEntry({ ...base, at: '' })).toThrow(/fecha/i);
    expect(() => newEntry({ ...base, at: undefined })).toThrow(/fecha/i);
    expect(() => newEntry({ ...base, at: '2026-10-14T09:00:00+02:00' })).toThrow(/fecha/i);
    expect(() => newEntry({ ...base, at: '2026-13-40T09:00:00Z' })).toThrow(/fecha/i);
    expect(() => newEntry({ ...base, at: '2026-02-29T09:00:00Z' })).toThrow(/fecha/i);
    expect(newEntry({ ...base, at: '2028-02-29T09:00:00Z' }).at).toBe('2028-02-29T09:00:00.000Z');
  });

  it('sin nivel o dimensión no hay entrada: quedaría huérfana', () => {
    const base = { kind: 'proof', text: 'x', by: EM, at: '2026-10-14T09:00:00Z' };
    expect(() => newEntry({ ...base, levelId: '', dimensionId: 'tech' })).toThrow(/expectativa/i);
    expect(() => newEntry({ ...base, levelId: 'l2', dimensionId: undefined })).toThrow(/expectativa/i);
    expect(() => newEntry({ ...base, levelId: 2, dimensionId: 'tech' })).toThrow(/expectativa/i);
    expect(() => newEntry({ ...base, levelId: ' l2 ', dimensionId: 'tech' })).toThrow(/expectativa/i);
  });

  it('sin texto, con un tipo desconocido o con un enlace que no es web, no hay entrada', () => {
    expect(() => newEntry({ levelId: 'l2', dimensionId: 'tech', kind: 'meets', text: ' ', by: EM, at: 't' })).toThrow(/evidencia/i);
    expect(() => newEntry({ levelId: 'l2', dimensionId: 'tech', kind: 'quizá', text: 'x', by: EM, at: 't' })).toThrow(/tipo/i);
    expect(() => newEntry({ levelId: 'l2', dimensionId: 'tech', kind: 'proof', text: 'x', links: [{ kind: 'pr', url: 'javascript:1' }], by: EM, at: 't' })).toThrow(/enlace/i);
  });

  it('los tipos son llega, no llega y prueba', () => {
    expect(ENTRY_KINDS).toEqual(['meets', 'misses', 'proof']);
  });
});

describe('expectationState: dónde está ahora la expectativa', () => {
  it('manda la última entrada con estado; las pruebas no lo cambian', () => {
    const entries = [entry('misses', '2026-09-02T10:00:00.000Z'), entry('meets', '2026-10-14T10:00:00.000Z'), entry('proof', '2026-10-20T10:00:00.000Z', { by: DEV })];
    expect(expectationState(entries, 'l2', 'tech', 'misses')).toBe('meets');
  });

  it('sin entradas con estado, vale el de partida', () => {
    expect(expectationState([entry('proof', 't')], 'l2', 'tech', 'meets')).toBe('meets');
    expect(expectationState([], 'l2', 'tech', 'open')).toBe('open');
  });

  it('solo cuentan las de esa expectativa', () => {
    expect(expectationState([entry('misses', 't', { dimensionId: 'product' })], 'l2', 'tech', 'meets')).toBe('meets');
  });
});

describe('timelineFor: la evolución, de lo más reciente a lo más antiguo', () => {
  it('filtra por expectativa y ordena por fecha descendente', () => {
    const entries = [
      entry('misses', '2026-09-02T10:00:00.000Z'), entry('meets', '2026-10-14T10:00:00.000Z'),
      entry('proof', '2026-08-20T10:00:00.000Z', { dimensionId: 'product' }),
    ];
    expect(timelineFor(entries, 'l2', 'tech').map((e) => e.at)).toEqual(['2026-10-14T10:00:00.000Z', '2026-09-02T10:00:00.000Z']);
  });
});
