import { describe, it, expect } from 'vitest';
import { meanTimeToRecovery } from './mttr.js';

/** Periodo de enero 2025 (2025-01-01 → 2025-01-31). */
const PERIOD = { from: '2025-01-01T00:00:00Z', to: '2025-01-31T23:59:59Z' };

describe('meanTimeToRecovery', () => {
  it('promedia el downtime de los incidentes resueltos dentro de la ventana', () => {
    const incidents = [
      // 2 h de downtime
      { startedAt: '2025-01-10T00:00:00Z', restoredAt: '2025-01-10T02:00:00Z' },
      // 6 h de downtime
      { startedAt: '2025-01-15T00:00:00Z', restoredAt: '2025-01-15T06:00:00Z' },
    ];
    expect(meanTimeToRecovery(incidents, PERIOD)).toEqual({
      mttrHoursAvg: 4, // (2 + 6) / 2
      downtimeHoursTotal: 8,
      resolvedCount: 2,
      openCount: 0,
    });
  });

  it('los incidentes abiertos (restoredAt null) cuentan en openCount, no en la media', () => {
    const incidents = [
      { startedAt: '2025-01-10T00:00:00Z', restoredAt: '2025-01-10T04:00:00Z' }, // 4 h
      { startedAt: '2025-01-20T00:00:00Z', restoredAt: null }, // abierto
      { startedAt: '2025-01-25T00:00:00Z', restoredAt: null }, // abierto
    ];
    expect(meanTimeToRecovery(incidents, PERIOD)).toEqual({
      mttrHoursAvg: 4,
      downtimeHoursTotal: 4,
      resolvedCount: 1,
      openCount: 2,
    });
  });

  it('sin incidentes resueltos → mttrHoursAvg null (no medible)', () => {
    expect(meanTimeToRecovery([], PERIOD)).toEqual({
      mttrHoursAvg: null,
      downtimeHoursTotal: 0,
      resolvedCount: 0,
      openCount: 0,
    });
    // Solo abiertos: tampoco es medible, pero se reportan como abiertos.
    expect(meanTimeToRecovery([{ startedAt: '2025-01-05T00:00:00Z', restoredAt: null }], PERIOD)).toEqual({
      mttrHoursAvg: null,
      downtimeHoursTotal: 0,
      resolvedCount: 0,
      openCount: 1,
    });
  });

  it('los resueltos con restoredAt fuera de la ventana no cuentan', () => {
    const incidents = [
      { startedAt: '2024-12-30T00:00:00Z', restoredAt: '2024-12-31T00:00:00Z' }, // restaurado antes de from
      { startedAt: '2025-02-01T00:00:00Z', restoredAt: '2025-02-02T00:00:00Z' }, // restaurado después de to
      { startedAt: '2025-01-15T00:00:00Z', restoredAt: '2025-01-15T03:00:00Z' }, // dentro → 3 h
    ];
    expect(meanTimeToRecovery(incidents, PERIOD)).toEqual({
      mttrHoursAvg: 3,
      downtimeHoursTotal: 3,
      resolvedCount: 1,
      openCount: 0,
    });
  });

  it('incluye los incidentes cuyo restoredAt cae justo en los límites (inclusivo)', () => {
    const incidents = [
      { startedAt: '2024-12-31T22:00:00Z', restoredAt: '2025-01-01T00:00:00Z' }, // restoredAt == from → 2 h
      { startedAt: '2025-01-31T21:59:59Z', restoredAt: '2025-01-31T23:59:59Z' }, // restoredAt == to → 2 h
    ];
    const r = meanTimeToRecovery(incidents, PERIOD);
    expect(r.resolvedCount).toBe(2);
    expect(r.mttrHoursAvg).toBe(2);
  });

  it('descarta downtimes negativos (restauración antes del inicio)', () => {
    const incidents = [
      { startedAt: '2025-01-10T05:00:00Z', restoredAt: '2025-01-10T02:00:00Z' }, // negativo → descartado
      { startedAt: '2025-01-12T00:00:00Z', restoredAt: '2025-01-12T05:00:00Z' }, // 5 h
    ];
    expect(meanTimeToRecovery(incidents, PERIOD)).toEqual({
      mttrHoursAvg: 5,
      downtimeHoursTotal: 5,
      resolvedCount: 1,
      openCount: 0,
    });
  });

  it('descarta incidentes con fechas no parseables (ni resueltos ni abiertos)', () => {
    const incidents = [
      { startedAt: '2025-01-10T00:00:00Z', restoredAt: 'no-es-fecha' }, // restoredAt inválido
      { startedAt: 'no-es-fecha', restoredAt: '2025-01-11T02:00:00Z' }, // startedAt inválido → downtime NaN
      { startedAt: '2025-01-12T00:00:00Z', restoredAt: '2025-01-12T04:00:00Z' }, // 4 h
    ];
    expect(meanTimeToRecovery(incidents, PERIOD)).toEqual({
      mttrHoursAvg: 4,
      downtimeHoursTotal: 4,
      resolvedCount: 1,
      openCount: 0,
    });
  });

  it('redondea la media a 1 decimal', () => {
    const incidents = [
      { startedAt: '2025-01-10T00:00:00Z', restoredAt: '2025-01-10T01:00:00Z' }, // 1 h
      { startedAt: '2025-01-11T00:00:00Z', restoredAt: '2025-01-11T02:00:00Z' }, // 2 h
      { startedAt: '2025-01-12T00:00:00Z', restoredAt: '2025-01-12T02:00:00Z' }, // 2 h
    ];
    // (1 + 2 + 2) / 3 = 1.666… → 1.7
    expect(meanTimeToRecovery(incidents, PERIOD).mttrHoursAvg).toBe(1.7);
  });

  it('lista no-array → valores neutros', () => {
    expect(meanTimeToRecovery(undefined, PERIOD)).toEqual({
      mttrHoursAvg: null,
      downtimeHoursTotal: 0,
      resolvedCount: 0,
      openCount: 0,
    });
  });
});
