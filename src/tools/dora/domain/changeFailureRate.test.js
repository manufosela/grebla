import { describe, it, expect } from 'vitest';
import { changeFailureRate } from './changeFailureRate.js';

/** Periodo de 4 semanas (2025-01-01 → 2025-01-29). */
const PERIOD = { from: '2025-01-01T00:00:00Z', to: '2025-01-29T00:00:00Z' };

describe('changeFailureRate', () => {
  it('todo success dentro de la ventana → 0 %', () => {
    const events = [
      { at: '2025-01-05T10:00:00Z', status: 'success' },
      { at: '2025-01-10T10:00:00Z', status: 'success' },
    ];
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 0, failed: 0, total: 2 });
  });

  it('mezcla de success y failed → porcentaje redondeado a 1 decimal', () => {
    const events = [
      { at: '2025-01-05T10:00:00Z', status: 'success' },
      { at: '2025-01-06T10:00:00Z', status: 'failed' },
      { at: '2025-01-07T10:00:00Z', status: 'success' },
    ];
    // 1 fallido / 3 total = 33.33… → 33.3
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 33.3, failed: 1, total: 3 });
  });

  it('todos fallidos → 100 %', () => {
    const events = [
      { at: '2025-01-05T10:00:00Z', status: 'failed' },
      { at: '2025-01-06T10:00:00Z', status: 'failed' },
    ];
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 100, failed: 2, total: 2 });
  });

  it('sin eventos → cfrPct null (no medible), contadores en 0', () => {
    expect(changeFailureRate([], PERIOD)).toEqual({ cfrPct: null, failed: 0, total: 0 });
    expect(changeFailureRate(undefined, PERIOD)).toEqual({ cfrPct: null, failed: 0, total: 0 });
  });

  it('incluye los eventos justo en los límites (inclusivo)', () => {
    const events = [
      { at: '2025-01-01T00:00:00Z', status: 'failed' }, // == from
      { at: '2025-01-29T00:00:00Z', status: 'success' }, // == to
    ];
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 50, failed: 1, total: 2 });
  });

  it('los eventos fuera de la ventana no cuentan (ni en total ni en failed)', () => {
    const events = [
      { at: '2024-12-31T23:59:59Z', status: 'failed' }, // antes de from → fuera
      { at: '2025-01-10T10:00:00Z', status: 'failed' }, // dentro
      { at: '2025-01-10T12:00:00Z', status: 'success' }, // dentro
      { at: '2025-02-01T00:00:00Z', status: 'failed' }, // después de to → fuera
    ];
    // Solo cuentan los 2 de dentro: 1 fallido / 2 total = 50 %
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 50, failed: 1, total: 2 });
  });

  it('descarta eventos con at no parseable', () => {
    const events = [
      { at: 'no-es-fecha', status: 'failed' },
      { at: '2025-01-10T10:00:00Z', status: 'failed' },
      { at: '2025-01-11T10:00:00Z', status: 'success' },
    ];
    // El no parseable se descarta: 1 fallido / 2 total = 50 %
    expect(changeFailureRate(events, PERIOD)).toEqual({ cfrPct: 50, failed: 1, total: 2 });
  });
});
