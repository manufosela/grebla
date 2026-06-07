import { describe, it, expect } from 'vitest';
import { busFactor, areasAtRisk } from './busFactor.js';

const cov = [
  { personId: 'p1', areaId: 'kafka', level: 5 },
  { personId: 'p2', areaId: 'kafka', level: 4 },
  { personId: 'p3', areaId: 'kafka', level: 2 }, // por debajo del umbral → no cuenta
  { personId: 'p1', areaId: 'billing', level: 6 }, // solo p1 → bus factor 1
  { personId: 'p2', areaId: 'legacy', level: 1 }, // nadie alcanza umbral → bus factor 0
];

describe('busFactor por área (umbral Peritus=3)', () => {
  it('cuenta personas distintas con nivel >= umbral', () => {
    const bf = Object.fromEntries(busFactor(cov).map((a) => [a.areaId, a]));
    expect(bf.kafka.count).toBe(2); // p1, p2 (p3 no llega al umbral)
    expect(bf.kafka.atRisk).toBe(false);
    expect(bf.billing).toMatchObject({ count: 1, atRisk: true }); // bus factor 1
    expect(bf.legacy).toMatchObject({ count: 0, atRisk: true });
  });

  it('respeta un umbral configurable', () => {
    const bf = Object.fromEntries(busFactor(cov, { minLevel: 5 }).map((a) => [a.areaId, a]));
    expect(bf.kafka.count).toBe(1); // solo p1 (level 5); p2 level 4 < 5
  });

  it('incluye áreas sin cobertura cuando se pasan areaIds', () => {
    const bf = Object.fromEntries(busFactor([], { areaIds: ['ml'] }).map((a) => [a.areaId, a]));
    expect(bf.ml).toMatchObject({ count: 0, atRisk: true });
  });

  it('areasAtRisk filtra las de bus factor < 2', () => {
    const risk = areasAtRisk(cov).map((a) => a.areaId).sort();
    expect(risk).toEqual(['billing', 'legacy']);
  });
});
