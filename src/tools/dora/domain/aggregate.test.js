import { describe, it, expect } from 'vitest';
import { aggregateMetrics, aggregateByKey, teamKeyOf, guildKeyOf } from './aggregate.js';

const repos = [
  { fullName: 'o/a', team: 'Plataforma', guilds: ['Frontend'], metrics: { deployments: 10, deployFrequencyPerWeek: 2.5, leadTimeHoursAvg: 10, contributorLogins: ['ana', 'bea'], deploymentsFailed: 1, deploymentsTotal: 10, downtimeHoursTotal: 4, incidentsResolved: 2, incidentsOpen: 1 } },
  { fullName: 'o/b', team: 'Plataforma', guilds: ['Backend'], metrics: { deployments: 30, deployFrequencyPerWeek: 7.5, leadTimeHoursAvg: 20, contributorLogins: ['bea', 'caro'], deploymentsFailed: 3, deploymentsTotal: 30, downtimeHoursTotal: 8, incidentsResolved: 2, incidentsOpen: 0 } },
  { fullName: 'o/c', team: 'Pagos', guilds: ['Backend', 'Frontend'], metrics: { error: 'GitHub 404' } },
  { fullName: 'o/d', team: null, guilds: [] }, // sin métricas
];

describe('aggregateMetrics', () => {
  it('suma despliegues y frecuencia; lead time medio ponderado por despliegues', () => {
    const a = aggregateMetrics(repos);
    expect(a.repos).toBe(4);
    expect(a.measured).toBe(2); // o/c tiene error, o/d sin métricas
    expect(a.deployments).toBe(40);
    expect(a.deployFrequencyPerWeek).toBe(10); // 2.5 + 7.5
    expect(a.leadTimeHoursAvg).toBe(17.5); // (10*10 + 20*30)/40
  });

  it('sin repos medidos → lead time null', () => {
    expect(aggregateMetrics([{ metrics: { error: 'x' } }]).leadTimeHoursAvg).toBeNull();
  });

  it('personas = unión única de logins (bea está en o/a y o/b → cuenta una vez)', () => {
    expect(aggregateMetrics(repos).people).toBe(3); // ana, bea, caro
  });

  it('CFR agregado = Σfallidos/Σtotal (media ponderada, no media de porcentajes)', () => {
    const a = aggregateMetrics(repos);
    expect(a.deploymentsFailed).toBe(4); // 1 + 3
    expect(a.deploymentsTotal).toBe(40); // 10 + 30
    expect(a.changeFailureRatePct).toBe(10); // 4/40 × 100 (no (10%+10%)/2 casual)
  });

  it('sin despliegues en el grupo → CFR null (no medible)', () => {
    const a = aggregateMetrics([{ metrics: { deployments: 5, deploymentsFailed: 0, deploymentsTotal: 0 } }]);
    expect(a.changeFailureRatePct).toBeNull();
    expect(a.deploymentsTotal).toBe(0);
  });

  it('MTTR agregado = Σdowntime/Σresueltos (media ponderada, no media de MTTRs)', () => {
    const a = aggregateMetrics(repos);
    expect(a.downtimeHoursTotal).toBe(12); // 4 + 8
    expect(a.incidentsResolved).toBe(4); // 2 + 2
    expect(a.incidentsOpen).toBe(1); // 1 + 0
    expect(a.mttrHoursAvg).toBe(3); // 12/4 (no (2h+4h)/2 casual)
  });

  it('sin incidentes resueltos en el grupo → MTTR null (no medible)', () => {
    const a = aggregateMetrics([{ metrics: { deployments: 5, downtimeHoursTotal: 0, incidentsResolved: 0, incidentsOpen: 3 } }]);
    expect(a.mttrHoursAvg).toBeNull();
    expect(a.incidentsOpen).toBe(3);
  });
});

describe('aggregateByKey', () => {
  it('por equipo (repos sin equipo → "(sin equipo)")', () => {
    const byTeam = aggregateByKey(repos, teamKeyOf);
    const plataforma = byTeam.find((g) => g.key === 'Plataforma');
    expect(plataforma.deployments).toBe(40);
    expect(byTeam.some((g) => g.key === '(sin equipo)')).toBe(true);
  });

  it('por gremio (un repo puede estar en varios)', () => {
    const byGuild = aggregateByKey(repos, guildKeyOf);
    const keys = byGuild.map((g) => g.key);
    expect(keys).toContain('Frontend');
    expect(keys).toContain('Backend');
    expect(keys).toContain('(sin gremio)');
  });
});
