import { describe, it, expect } from 'vitest';
import {
  EMPTY_LOGBOOK,
  logEntryKey,
  normalizeLogbook,
  newCertificateEntries,
  appendLogbook,
  logbookView,
} from './logbook.js';

const cert = (ref, at, label = ref) => ({ kind: 'certificate', ref, label, at });

describe('normalizeLogbook', () => {
  it('sin datos devuelve una bitácora vacía', () => {
    expect(normalizeLogbook(null).entries).toEqual([]);
    expect(normalizeLogbook({}).entries).toEqual([]);
    expect(normalizeLogbook({ entries: 'x' }).entries).toEqual([]);
  });

  it('sanea y descarta apuntes inválidos, preservando el orden', () => {
    const data = {
      entries: [
        cert('bases/git', '2026-07-01T10:00:00Z', 'Git'),
        { kind: 'basura', ref: 'x', label: 'x', at: '2026-07-01T10:00:00Z' },
        { kind: 'certificate', ref: '', label: 'y', at: '2026-07-01T10:00:00Z' },
        { kind: 'route-start', ref: 'php--grumete', label: 'PHP', at: '' },
        { kind: 'route-start', ref: 'php--grumete', label: 'Backend PHP · Grumete', at: '2026-07-02T09:00:00Z' },
      ],
    };
    const { entries } = normalizeLogbook(data);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(cert('bases/git', '2026-07-01T10:00:00Z', 'Git'));
    expect(entries[1].kind).toBe('route-start');
  });
});

describe('logEntryKey', () => {
  it('certificados son únicos por casa; los eventos de ruta incluyen la fecha', () => {
    expect(logEntryKey(cert('bases/git', '2026-07-01T10:00:00Z'))).toBe('certificate:bases/git');
    const start = { kind: 'route-start', ref: 'php--grumete', label: 'x', at: '2026-07-02T09:00:00Z' };
    expect(logEntryKey(start)).toBe('route-start:php--grumete:2026-07-02T09:00:00Z');
  });
});

describe('newCertificateEntries', () => {
  const name = (id) => ({ 'bases/git': 'Git', 'bases/http-apis': 'HTTP y APIs' })[id] ?? id;

  it('crea un apunte por casa visitada aún no registrada', () => {
    const logbook = { entries: [cert('bases/git', '2026-07-01T10:00:00Z', 'Git')] };
    const out = newCertificateEntries(['bases/git', 'bases/http-apis'], logbook, name, '2026-07-03T08:00:00Z');
    expect(out).toEqual([
      { kind: 'certificate', ref: 'bases/http-apis', label: 'HTTP y APIs', at: '2026-07-03T08:00:00Z' },
    ]);
  });

  it('no duplica si visitedCities trae repetidos, y cae al id sin nombre', () => {
    const out = newCertificateEntries(['x/y', 'x/y'], EMPTY_LOGBOOK, name, '2026-07-03T08:00:00Z');
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('x/y');
  });
});

describe('appendLogbook', () => {
  it('añade apuntes nuevos y descarta los ya existentes por clave', () => {
    const base = { entries: [cert('bases/git', '2026-07-01T10:00:00Z', 'Git')] };
    const next = appendLogbook(base, [
      cert('bases/git', '2026-07-05T10:00:00Z', 'Git'), // misma casa: se ignora
      cert('bases/terminal', '2026-07-05T10:00:00Z', 'Terminal'),
    ]);
    expect(next.entries).toHaveLength(2);
    expect(next.entries[1].ref).toBe('bases/terminal');
  });

  it('sin apuntes nuevos devuelve la MISMA referencia (no reescribe)', () => {
    const base = { entries: [cert('bases/git', '2026-07-01T10:00:00Z', 'Git')] };
    expect(appendLogbook(base, [cert('bases/git', '2026-07-09T10:00:00Z', 'Git')])).toBe(base);
    expect(appendLogbook(base, [])).toBe(base);
  });
});

describe('logbookView', () => {
  it('ordena por fecha, más reciente primero, con empate estable', () => {
    const logbook = {
      entries: [
        cert('a', '2026-07-01T10:00:00Z'),
        cert('b', '2026-07-03T10:00:00Z'),
        cert('c', '2026-07-03T10:00:00Z'), // mismo instante que b, añadido después → antes
      ],
    };
    expect(logbookView(logbook).map((e) => e.ref)).toEqual(['c', 'b', 'a']);
  });
});
