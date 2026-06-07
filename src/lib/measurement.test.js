import { describe, it, expect } from 'vitest';
import { isMeasurementStale, tsToMs, MEASUREMENT_WINDOW_DAYS, hasContent, pickActiveMeasurement } from './measurement.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-07T00:00:00Z');

describe('isMeasurementStale (ventana trimestral por defecto)', () => {
  it('no es stale dentro de la ventana (edición sobrescribe)', () => {
    expect(isMeasurementStale(NOW - 10 * DAY, NOW)).toBe(false);
    expect(isMeasurementStale(NOW - 89 * DAY, NOW)).toBe(false);
  });

  it('es stale pasados 90 días (nuevo punto del histórico)', () => {
    expect(isMeasurementStale(NOW - 91 * DAY, NOW)).toBe(true);
    expect(isMeasurementStale(NOW - 200 * DAY, NOW)).toBe(true);
  });

  it('una medición sin fecha (recién creada) no es stale', () => {
    expect(isMeasurementStale(null, NOW)).toBe(false);
  });

  it('respeta una ventana personalizada (p. ej. mensual)', () => {
    expect(isMeasurementStale(NOW - 31 * DAY, NOW, 30)).toBe(true);
    expect(isMeasurementStale(NOW - 20 * DAY, NOW, 30)).toBe(false);
  });

  it('la ventana por defecto es 90 días', () => {
    expect(MEASUREMENT_WINDOW_DAYS).toBe(90);
  });
});

describe('hasContent / pickActiveMeasurement (ignorar sesiones vacías)', () => {
  it('hasContent distingue sesiones con y sin respuestas', () => {
    expect(hasContent({ answers: { q1: 3 } })).toBe(true);
    expect(hasContent({ answers: {} })).toBe(false);
    expect(hasContent({})).toBe(false);
    expect(hasContent(null)).toBe(false);
  });

  it('pickActiveMeasurement devuelve la más reciente con contenido, ignorando vacías', () => {
    const sessions = [
      { id: 'vacia-reciente', answers: {} }, // más reciente pero vacía → se ignora
      { id: 'con-datos', answers: { q1: 4 } },
      { id: 'otra-vacia', answers: {} },
    ];
    expect(pickActiveMeasurement(sessions)?.id).toBe('con-datos');
  });

  it('pickActiveMeasurement devuelve null si todas están vacías', () => {
    expect(pickActiveMeasurement([{ answers: {} }, { answers: {} }])).toBeNull();
    expect(pickActiveMeasurement([])).toBeNull();
    expect(pickActiveMeasurement(null)).toBeNull();
  });
});

describe('tsToMs normaliza formatos de timestamp', () => {
  it('acepta ms numéricos', () => {
    expect(tsToMs(NOW)).toBe(NOW);
  });
  it('acepta Firestore Timestamp (toMillis / toDate / seconds)', () => {
    expect(tsToMs({ toMillis: () => NOW })).toBe(NOW);
    expect(tsToMs({ toDate: () => new Date(NOW) })).toBe(NOW);
    expect(tsToMs({ seconds: NOW / 1000 })).toBe(NOW);
  });
  it('acepta ISO string y devuelve null para inválidos', () => {
    expect(tsToMs('2026-06-07T00:00:00Z')).toBe(NOW);
    expect(tsToMs(null)).toBeNull();
    expect(tsToMs('no-fecha')).toBeNull();
  });
});
