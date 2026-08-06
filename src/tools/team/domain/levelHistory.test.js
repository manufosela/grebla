import { describe, it, expect } from 'vitest';
import { appendLevelChange, normalizeLevelHistory, levelHistoryView } from './levelHistory.js';

describe('appendLevelChange — el relato de promociones (RMR-PCS-0037)', () => {
  it('añade la entrada sin mutar el historial anterior', () => {
    const history = [];
    const next = appendLevelChange(history, { from: 'l1', to: 'l2', at: '2026-08-06T08:00:00Z', byUid: 'u1', note: 'promoción tras el ciclo' });
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual({ from: 'l1', to: 'l2', at: '2026-08-06T08:00:00Z', byUid: 'u1', note: 'promoción tras el ciclo' });
    expect(history).toHaveLength(0);
  });

  it('mismo nivel → no-op (devuelve el historial tal cual; sin historial, [])', () => {
    const history = [{ from: 'l1', to: 'l2', at: 'x', byUid: 'u1', note: null }];
    expect(appendLevelChange(history, { from: 'l2', to: 'l2', at: 'y', byUid: 'u1' })).toBe(history);
    expect(appendLevelChange(null, { from: 'l2', to: 'l2', at: 'y', byUid: 'u1' })).toEqual([]);
  });

  it('exige destino y fecha; la nota vacía queda null', () => {
    expect(() => appendLevelChange([], { from: 'l1', to: '', at: 'x', byUid: 'u1' })).toThrow(/nivel/i);
    expect(() => appendLevelChange([], { from: 'l1', to: 'l2', at: '', byUid: 'u1' })).toThrow(/fecha/i);
    const next = appendLevelChange([], { from: null, to: 'l1', at: 'x', byUid: 'u1', note: '   ' });
    expect(next[0]).toEqual({ from: null, to: 'l1', at: 'x', byUid: 'u1', note: null });
  });

  it('acepta el primer nivel (from null) y las bajadas', () => {
    const first = appendLevelChange([], { from: null, to: 'l2', at: 'x', byUid: 'u1' });
    const down = appendLevelChange(first, { from: 'l2', to: 'l1', at: 'y', byUid: 'u1', note: 'calibración inicial' });
    expect(down.map((e) => e.to)).toEqual(['l2', 'l1']);
  });
});

describe('normalizeLevelHistory — lectura tolerante', () => {
  it('array válido pasa; basura → []; entradas rotas se descartan', () => {
    expect(normalizeLevelHistory(null)).toEqual([]);
    expect(normalizeLevelHistory('nope')).toEqual([]);
    const mixed = [
      { from: 'l1', to: 'l2', at: '2026-01-01', byUid: 'u1', note: null },
      { to: '', at: '' },
      'basura',
    ];
    expect(normalizeLevelHistory(mixed)).toHaveLength(1);
  });
});

describe('levelHistoryView — filas listas para pintar', () => {
  const levels = [
    { id: 'eng-l1', code: 'L1' },
    { id: 'eng-l2', code: 'L2' },
  ];

  it('resuelve códigos, formatea la fecha en español y ordena de reciente a antiguo', () => {
    const raw = [
      { from: null, to: 'eng-l1', at: '2026-01-15T10:00:00Z', byUid: 'u1', note: null },
      { from: 'eng-l1', to: 'eng-l2', at: '2026-08-06T08:00:00Z', byUid: 'u1', note: 'promoción' },
    ];
    const rows = levelHistoryView(raw, levels);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ fromCode: 'L1', toCode: 'L2', note: 'promoción' });
    expect(rows[0].when).toMatch(/2026/);
    expect(rows[1]).toMatchObject({ fromCode: null, toCode: 'L1', note: null });
  });

  it('nivel desconocido en el framework → muestra el id tal cual; basura → []', () => {
    const rows = levelHistoryView([{ from: 'viejo', to: 'eng-l2', at: '2026-02-01', byUid: null, note: null }], levels);
    expect(rows[0].fromCode).toBe('viejo');
    expect(levelHistoryView(null, levels)).toEqual([]);
  });
});
