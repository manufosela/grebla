import { describe, it, expect } from 'vitest';
import { newEntry, expectationState, timelineFor, ENTRY_KINDS, entryKindsFor } from './evidence.js';

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
