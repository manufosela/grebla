import { describe, it, expect } from 'vitest';
import { deploymentFrequencyPerWeek, countDeployments } from './deployments.js';

/** Periodo de 4 semanas usado en varios casos (2025-01-01 → 2025-01-29). */
const PERIOD = { from: '2025-01-01T00:00:00Z', to: '2025-01-29T00:00:00Z' };

describe('countDeployments', () => {
  it('cuenta solo eventos success dentro de la ventana', () => {
    const events = [
      { at: '2025-01-05T10:00:00Z', status: 'success' },
      { at: '2025-01-10T10:00:00Z', status: 'success' },
      { at: '2025-01-12T10:00:00Z', status: 'failed' }, // fallido → no cuenta
      { at: '2024-12-31T10:00:00Z', status: 'success' }, // fuera (antes) → no cuenta
      { at: '2025-02-01T10:00:00Z', status: 'success' }, // fuera (después) → no cuenta
    ];
    expect(countDeployments(events, PERIOD)).toBe(2);
  });

  it('descarta eventos con at no parseable', () => {
    const events = [
      { at: 'no-es-fecha', status: 'success' },
      { at: '2025-01-05T10:00:00Z', status: 'success' },
    ];
    expect(countDeployments(events, PERIOD)).toBe(1);
  });

  it('incluye los eventos justo en los límites (inclusivo)', () => {
    const events = [
      { at: '2025-01-01T00:00:00Z', status: 'success' }, // == from
      { at: '2025-01-29T00:00:00Z', status: 'success' }, // == to
    ];
    expect(countDeployments(events, PERIOD)).toBe(2);
  });
});

describe('deploymentFrequencyPerWeek', () => {
  it('divide los success de la ventana entre las semanas del periodo', () => {
    const events = [
      { at: '2025-01-02T10:00:00Z', status: 'success' },
      { at: '2025-01-09T10:00:00Z', status: 'success' },
      { at: '2025-01-16T10:00:00Z', status: 'success' },
    ];
    // 3 success / 4 semanas = 0.75 → 0.8
    expect(deploymentFrequencyPerWeek(events, PERIOD)).toBe(0.8);
  });

  it('ignora los fallidos y los que caen fuera de la ventana', () => {
    const events = [
      { at: '2025-01-05T10:00:00Z', status: 'success' },
      { at: '2025-01-06T10:00:00Z', status: 'failed' },
      { at: '2025-03-01T10:00:00Z', status: 'success' },
    ];
    // 1 success / 4 semanas = 0.25 → 0.3
    expect(deploymentFrequencyPerWeek(events, PERIOD)).toBe(0.3);
  });

  it('periodo < 1 semana usa un mínimo de 1 semana', () => {
    const events = [
      { at: '2025-01-01T06:00:00Z', status: 'success' },
      { at: '2025-01-01T12:00:00Z', status: 'success' },
    ];
    // 2 success / max(1, 1día/7) = 2 / 1 = 2
    expect(deploymentFrequencyPerWeek(events, { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' })).toBe(2);
  });

  it('sin eventos → 0', () => {
    expect(deploymentFrequencyPerWeek([], PERIOD)).toBe(0);
    expect(deploymentFrequencyPerWeek(undefined, PERIOD)).toBe(0);
  });
});
