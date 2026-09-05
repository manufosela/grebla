import { describe, it, expect } from 'vitest';
import {
  scopeOf, subdomainKeyForTeam, doraCurrent, leanCurrent, calcFailed, hasAnyNumber,
  accumulateSeries, buildSnapshot,
} from './snapshot.js';

const SUBDOMAINS = [
  { key: 'caes', domainKey: 'tribbu-app' },
  { key: 'internal-products-core', domainKey: 'internal-products' },
];
const DOMAINS = [{ key: 'tribbu-app' }, { key: 'internal-products' }];

describe('scopeOf: el ámbito sale del catálogo, no del nombre', () => {
  it('devuelve el subdominio y su dominio', () => {
    expect(scopeOf('caes', SUBDOMAINS, DOMAINS)).toEqual({ subdomain: 'caes', domain: 'tribbu-app' });
  });

  it('también en los degenerados: el Core lleva su dominio', () => {
    expect(scopeOf('internal-products-core', SUBDOMAINS, DOMAINS))
      .toEqual({ subdomain: 'internal-products-core', domain: 'internal-products' });
  });

  it('una clave fuera del catálogo no se publica', () => {
    // Antes se fabricaba la clave con slugify(nombre) y cualquier cosa entraba;
    // publicar algo que el catálogo no conoce es el desajuste de partida.
    expect(scopeOf('the-mario-netas', SUBDOMAINS, DOMAINS)).toBeNull();
    expect(scopeOf('', SUBDOMAINS, DOMAINS)).toBeNull();
  });

  it('un subdominio cuyo dominio no existe tampoco se publica', () => {
    const huerfano = [{ key: 'suelto', domainKey: 'no-existe' }];
    expect(scopeOf('suelto', huerfano, DOMAINS)).toBeNull();
  });
});

describe('subdomainKeyForTeam: busca la unidad, no fabrica la clave', () => {
  const units = [
    { name: 'CAEs', subdomainKey: 'caes' },
    { linearLabel: 'Internal Products', subdomainKey: 'internal-products-core' },
    { name: 'Sin enganchar' },
  ];

  it('encuentra la unidad que mide ese equipo y devuelve SU clave', () => {
    expect(subdomainKeyForTeam('CAEs', units)).toBe('caes');
    expect(subdomainKeyForTeam('Internal Products', units)).toBe('internal-products-core');
  });

  it('«CAEs» y «CAES» son la misma entidad escrita de dos formas', () => {
    expect(subdomainKeyForTeam('CAES', units)).toBe('caes');
  });

  it('sin unidad, o con la unidad sin enganchar, no hay clave que valga', () => {
    expect(subdomainKeyForTeam('Matcher', units)).toBeNull();
    expect(subdomainKeyForTeam('Sin enganchar', units)).toBeNull();
    expect(subdomainKeyForTeam('', units)).toBeNull();
  });
});

describe('doraCurrent (unidades)', () => {
  it('mapea con lead time real, CFR a fracción y MTTR en horas', () => {
    const agg = { deployFrequencyPerWeek: 4.3, leadTimeCommitDeployHoursAvg: 18, changeFailureRatePct: 8, mttrHoursAvg: 3.1 };
    expect(doraCurrent(agg)).toEqual({ deploymentFrequency: 4.3, leadTimeForChanges: 18, changeFailureRate: 0.08, timeToRestore: 3.1 });
  });
  it('cae al lead time de PR si no hay lead time real, y deja null lo ausente', () => {
    const agg = { deployFrequencyPerWeek: 2, leadTimeCommitDeployHoursAvg: null, leadTimeHoursAvg: 26, changeFailureRatePct: null, mttrHoursAvg: null };
    expect(doraCurrent(agg)).toEqual({ deploymentFrequency: 2, leadTimeForChanges: 26, changeFailureRate: null, timeToRestore: null });
  });
});

describe('leanCurrent', () => {
  it('mapea cycle p50, throughput y wip; flowEfficiency null (GREBLA no lo calcula)', () => {
    const m = { cycleTimeP50Hours: 29, throughputPerWeek: 11, wip: 6 };
    expect(leanCurrent(m)).toEqual({ cycleTime: 29, throughput: 11, wip: 6, flowEfficiency: null });
  });
});

describe('calcFailed / hasAnyNumber', () => {
  it('detecta un cálculo fallido o ausente', () => {
    expect(calcFailed(null)).toBe(true);
    expect(calcFailed({ error: 'timeout' })).toBe(true);
    expect(calcFailed({ throughputPerWeek: 3 })).toBe(false);
  });
  it('hasAnyNumber es falso si todo es null', () => {
    expect(hasAnyNumber({ a: null, b: null })).toBe(false);
    expect(hasAnyNumber({ a: null, b: 0 })).toBe(true);
  });
});

describe('accumulateSeries', () => {
  it('reemplaza el punto de la misma semana (idempotente) y ordena', () => {
    const prev = [{ periodStart: '2026-06-16', throughput: 7 }];
    const out = accumulateSeries(prev, { periodStart: '2026-06-16', throughput: 9 });
    expect(out).toEqual([{ periodStart: '2026-06-16', throughput: 9 }]);
  });
  it('añade semanas nuevas y conserva solo las últimas 8', () => {
    const prev = Array.from({ length: 8 }, (_, i) => ({ periodStart: `2026-01-0${i + 1}`, v: i }));
    const out = accumulateSeries(prev, { periodStart: '2026-02-01', v: 99 });
    expect(out).toHaveLength(8);
    expect(out.at(-1)).toEqual({ periodStart: '2026-02-01', v: 99 });
    expect(out[0].periodStart).toBe('2026-01-02'); // se cae la más antigua
  });
});

describe('buildSnapshot', () => {
  it('ensambla el doc con el esquema del portal y la serie acumulada', () => {
    const snap = buildSnapshot({
      subdomain: 'tribbu-app-core', domain: 'tribbu-app',
      updatedAt: '2026-07-28T06:00:00Z', periodStart: '2026-07-27',
      current: { deploymentFrequency: 4.3, leadTimeForChanges: 18, changeFailureRate: 0.08, timeToRestore: 3.1 },
      prevSeries: [{ periodStart: '2026-06-16', deploymentFrequency: 3.2 }],
    });
    expect(snap.period).toBe('weekly');
    expect(snap.current.deploymentFrequency).toBe(4.3);
    expect(snap.series).toHaveLength(2);
    expect(snap.series.at(-1)).toMatchObject({ periodStart: '2026-07-27', deploymentFrequency: 4.3 });
  });

  it('lleva el subdominio y el dominio explícitos: el portal agrega sin parsear ids', () => {
    const snap = buildSnapshot({
      subdomain: 'internal-products-core', domain: 'internal-products',
      updatedAt: '2026-09-07T06:00:00Z', periodStart: '2026-09-07',
      current: { cycleTime: 147.2, throughput: 9.5, wip: 41, flowEfficiency: null },
    });
    expect(snap.subdomain).toBe('internal-products-core');
    expect(snap.domain).toBe('internal-products');
    // `squad` se mantiene con el mismo valor mientras dure la transición: el
    // portal ya lo lee y quitárselo de golpe le rompería el informe.
    expect(snap.squad).toBe('internal-products-core');
  });
});
