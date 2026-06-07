import { describe, it, expect } from 'vitest';
import { silenceAlerts } from './silenceAlerts.js';

const NOW = '2026-06-07T00:00:00Z';

describe('silenceAlerts (R7 — silencios según cadencia configurada)', () => {
  it('marca a quien supera la cadencia y excluye a quien está dentro', () => {
    const activities = [
      { personId: 'reciente', lastActivityDate: '2026-06-01T00:00:00Z' }, // 6 días
      { personId: 'silencioso', lastActivityDate: '2026-04-01T00:00:00Z' }, // ~67 días
    ];
    const alerts = silenceAlerts(activities, 30, NOW);
    const ids = alerts.map((a) => a.personId);
    expect(ids).toContain('silencioso');
    expect(ids).not.toContain('reciente');
  });

  it('trata "nunca registrado" (null) como silencio con daysSince Infinity', () => {
    const alerts = silenceAlerts([{ personId: 'nuevo', lastActivityDate: null }], 30, NOW);
    expect(alerts[0]).toMatchObject({ personId: 'nuevo', daysSince: Infinity });
  });

  it('ordena por tiempo en silencio (cola de atención, no ranking de desempeño)', () => {
    const activities = [
      { personId: 'b', lastActivityDate: '2026-05-01T00:00:00Z' }, // ~37 días
      { personId: 'a', lastActivityDate: null }, // Infinity
      { personId: 'c', lastActivityDate: '2026-03-01T00:00:00Z' }, // ~98 días
    ];
    const ids = silenceAlerts(activities, 30, NOW).map((a) => a.personId);
    expect(ids).toEqual(['a', 'c', 'b']);
  });

  it('la cadencia es configurable', () => {
    const activities = [{ personId: 'p', lastActivityDate: '2026-05-20T00:00:00Z' }]; // ~18 días
    expect(silenceAlerts(activities, 30, NOW)).toHaveLength(0); // dentro de 30
    expect(silenceAlerts(activities, 7, NOW)).toHaveLength(1); // fuera de 7
  });
});
