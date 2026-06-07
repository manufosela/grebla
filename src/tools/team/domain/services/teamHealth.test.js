import { describe, it, expect } from 'vitest';
import { teamHealth } from './teamHealth.js';

const NOW = '2026-06-07T00:00:00Z';
const settings = { cadenceDays: 30, busFactorMinLevel: 3, features: { fileStorage: false } };

const input = {
  contributions: [
    { roles: { PL: 'primary', CO: 'secondary' } },
    { roles: { SH: 'primary' } },
  ],
  coverage: [
    { personId: 'p1', areaId: 'kafka', level: 5 },
    { personId: 'p2', areaId: 'kafka', level: 4 },
    { personId: 'p1', areaId: 'billing', level: 6 }, // bus factor 1
  ],
  activities: [
    { personId: 'p1', lastActivityDate: '2026-06-05T00:00:00Z' }, // reciente
    { personId: 'p2', lastActivityDate: '2026-03-01T00:00:00Z' }, // silencio
  ],
  seniorities: [{ level: 3 }, { level: 3 }, { level: 6 }],
  areaIds: ['kafka', 'billing'],
  settings,
  now: NOW,
  teamSize: 2,
};

describe('teamHealth (R1/R3/R6 — agregado cualitativo, sin nivel global ni ranking)', () => {
  it('agrega cobertura de roles, gaps, bus factor, silencios y distribución', () => {
    const h = teamHealth(input);
    expect(h.teamSize).toBe(2);
    expect(h.roleCoverage.find((r) => r.sigla === 'PL').score).toBe(1.0);
    expect(h.uncoveredRoles.length).toBe(6); // 9 roles - {PL, CO, SH} ejercidos
  });

  it('cuenta áreas en riesgo y bus factor 1', () => {
    const h = teamHealth(input);
    expect(h.busFactorOneCount).toBe(1); // billing
    expect(h.areasAtRiskCount).toBe(1); // billing (kafka tiene 2)
  });

  it('cuenta silencios según cadencia', () => {
    const h = teamHealth(input);
    expect(h.silenceCount).toBe(1);
    expect(h.silence[0].personId).toBe('p2');
  });

  it('distribución de seniority por nivel, sin nombrar personas (R3)', () => {
    const h = teamHealth(input);
    const dist = Object.fromEntries(h.seniorityDistribution.map((d) => [d.name, d.count]));
    expect(dist.Peritus).toBe(2); // dos en nivel 3
    expect(dist.Primus).toBe(1); // uno en nivel 6
    expect(dist.Magister).toBe(0);
    // No existe ningún campo que ordene o puntúe a personas individuales.
    expect(JSON.stringify(h)).not.toMatch(/personId.*score|rank/i);
  });

  it('NO expone un nivel global de persona ni promedia dimensiones (R1)', () => {
    const h = teamHealth(input);
    expect(h).not.toHaveProperty('overall');
    expect(h).not.toHaveProperty('globalLevel');
  });
});
