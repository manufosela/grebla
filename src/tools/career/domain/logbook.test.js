import { describe, it, expect } from 'vitest';
import {
  EMPTY_LOGBOOK,
  logEntryKey,
  normalizeLogbook,
  newCertificateEntries,
  appendLogbook,
  logbookView,
  completedRoutes,
  formatDuration,
} from './logbook.js';

const cert = (ref, at, label = ref) => ({ kind: 'certificate', ref, label, at });
const start = (ref, at, label = ref) => ({ kind: 'route-start', ref, label, at });
const complete = (ref, at, label = ref) => ({ kind: 'route-complete', ref, label, at });

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

describe('route-complete', () => {
  it('normaliza el apunte route-complete y su clave lleva la fecha (repetible)', () => {
    const { entries } = normalizeLogbook({
      entries: [complete('php--grumete', '2026-07-06T12:00:00Z', 'Backend PHP · Grumete')],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('route-complete');
    expect(logEntryKey(entries[0])).toBe('route-complete:php--grumete:2026-07-06T12:00:00Z');
  });

  it('completar el mismo reto dos veces son dos apuntes (clave con fecha)', () => {
    const base = { entries: [complete('php--grumete', '2026-07-01T10:00:00Z')] };
    const next = appendLogbook(base, [complete('php--grumete', '2026-07-08T10:00:00Z')]);
    expect(next.entries).toHaveLength(2);
  });
});

describe('completedRoutes', () => {
  it('empareja cada route-complete con su route-start y calcula la duración', () => {
    const logbook = {
      entries: [
        start('php--grumete', '2026-07-01T09:00:00Z', 'Backend PHP · Grumete'),
        cert('bases/git', '2026-07-02T10:00:00Z'),
        complete('php--grumete', '2026-07-03T09:00:00Z', 'Backend PHP · Grumete'),
      ],
    };
    const done = completedRoutes(logbook);
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({
      routeId: 'php--grumete',
      name: 'Backend PHP · Grumete',
      startedAt: '2026-07-01T09:00:00Z',
      completedAt: '2026-07-03T09:00:00Z',
      durationMs: 2 * 24 * 60 * 60 * 1000, // 2 días
    });
  });

  it('sin route-start casado, startedAt y durationMs van a null (no inventa)', () => {
    const done = completedRoutes({ entries: [complete('php--grumete', '2026-07-03T09:00:00Z')] });
    expect(done[0].startedAt).toBeNull();
    expect(done[0].durationMs).toBeNull();
  });

  it('empareja el route-start MÁS RECIENTE anterior (reto repetido)', () => {
    const logbook = {
      entries: [
        start('php--grumete', '2026-06-01T09:00:00Z'),
        complete('php--grumete', '2026-06-05T09:00:00Z'),
        start('php--grumete', '2026-07-01T09:00:00Z'), // segunda vez
        complete('php--grumete', '2026-07-02T09:00:00Z'),
      ],
    };
    const done = completedRoutes(logbook);
    expect(done).toHaveLength(2);
    // Más reciente primero: el segundo completado empareja con el segundo inicio.
    expect(done[0].startedAt).toBe('2026-07-01T09:00:00Z');
    expect(done[1].startedAt).toBe('2026-06-01T09:00:00Z');
  });

  it('ordena de la finalización más reciente a la más antigua', () => {
    const logbook = {
      entries: [
        complete('a--x', '2026-07-01T09:00:00Z'),
        complete('b--y', '2026-07-09T09:00:00Z'),
      ],
    };
    expect(completedRoutes(logbook).map((r) => r.routeId)).toEqual(['b--y', 'a--x']);
  });
});

describe('formatDuration', () => {
  const MIN = 60000;
  it('formatea minutos, horas y días (mínimo 1 min)', () => {
    expect(formatDuration(30 * 1000)).toBe('1 min');
    expect(formatDuration(45 * MIN)).toBe('45 min');
    expect(formatDuration(90 * MIN)).toBe('1 h 30 min');
    expect(formatDuration(120 * MIN)).toBe('2 h');
    expect(formatDuration(25 * 60 * MIN)).toBe('1 d 1 h');
    expect(formatDuration(48 * 60 * MIN)).toBe('2 d');
  });
});
