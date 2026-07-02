import { describe, it, expect } from 'vitest';
import { leadTimeCommitToDeploy } from './leadTime.js';

describe('leadTimeCommitToDeploy', () => {
  it('casa cada cambio con el PRIMER despliegue success posterior al merge', () => {
    const changes = [{ firstCommitAt: '2025-01-01T00:00:00Z', mergedAt: '2025-01-02T00:00:00Z' }];
    const deployments = [
      { at: '2025-01-01T12:00:00Z', status: 'success' }, // antes del merge → no cuenta
      { at: '2025-01-02T06:00:00Z', status: 'success' }, // primero tras el merge → este
      { at: '2025-01-03T00:00:00Z', status: 'success' }, // posterior → se ignora
    ];
    const r = leadTimeCommitToDeploy(changes, deployments);
    // 2025-01-01T00:00 → 2025-01-02T06:00 = 30 h
    expect(r.leadTimeHoursAvg).toBe(30);
    expect(r.leadTimeHoursMedian).toBe(30);
    expect(r.deployedCount).toBe(1);
    expect(r.pendingCount).toBe(0);
  });

  it('ignora los despliegues failed al buscar el que llevó el cambio a producción', () => {
    const changes = [{ firstCommitAt: '2025-05-01T00:00:00Z', mergedAt: '2025-05-01T00:00:00Z' }];
    const deployments = [
      { at: '2025-05-01T02:00:00Z', status: 'failed' }, // fallido → no cuenta
      { at: '2025-05-01T08:00:00Z', status: 'success' }, // 8 h
    ];
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.leadTimeHoursAvg).toBe(8);
    expect(r.deployedCount).toBe(1);
    expect(r.pendingCount).toBe(0);
  });

  it('un cambio sin despliegue posterior queda PENDIENTE (no aporta al lead time)', () => {
    const changes = [{ firstCommitAt: '2025-02-01T00:00:00Z', mergedAt: '2025-02-10T00:00:00Z' }];
    const deployments = [
      { at: '2025-02-05T00:00:00Z', status: 'success' }, // anterior al merge → no lo despliega
    ];
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.leadTimeHoursAvg).toBeNull();
    expect(r.leadTimeHoursMedian).toBeNull();
    expect(r.deployedCount).toBe(0);
    expect(r.pendingCount).toBe(1);
  });

  it('calcula media y mediana sobre los cambios desplegados', () => {
    const changes = [
      { firstCommitAt: '2025-03-01T00:00:00Z', mergedAt: '2025-03-01T00:00:00Z' }, // → 10 h
      { firstCommitAt: '2025-03-02T00:00:00Z', mergedAt: '2025-03-02T00:00:00Z' }, // → 20 h
      { firstCommitAt: '2025-03-03T00:00:00Z', mergedAt: '2025-03-03T00:00:00Z' }, // → 6 h
    ];
    const deployments = [
      { at: '2025-03-01T10:00:00Z', status: 'success' },
      { at: '2025-03-02T20:00:00Z', status: 'success' },
      { at: '2025-03-03T06:00:00Z', status: 'success' },
    ];
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.leadTimeHoursAvg).toBe(12); // (10+20+6)/3
    expect(r.leadTimeHoursMedian).toBe(10); // ordenado [6,10,20]
    expect(r.deployedCount).toBe(3);
    expect(r.pendingCount).toBe(0);
  });

  it('mezcla desplegados y pendientes: solo los desplegados cuentan', () => {
    const changes = [
      { firstCommitAt: '2025-06-01T00:00:00Z', mergedAt: '2025-06-01T00:00:00Z' }, // desplegado → 4 h
      { firstCommitAt: '2025-06-02T00:00:00Z', mergedAt: '2025-06-30T00:00:00Z' }, // pendiente
    ];
    const deployments = [{ at: '2025-06-01T04:00:00Z', status: 'success' }];
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.leadTimeHoursAvg).toBe(4);
    expect(r.deployedCount).toBe(1);
    expect(r.pendingCount).toBe(1);
  });

  it('descarta lead times negativos (commit posterior al despliegue = dato inconsistente)', () => {
    const changes = [{ firstCommitAt: '2025-04-01T10:00:00Z', mergedAt: '2025-04-01T00:00:00Z' }];
    const deployments = [{ at: '2025-04-01T05:00:00Z', status: 'success' }]; // 5 - 10 = -5 h
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.leadTimeHoursAvg).toBeNull();
    expect(r.deployedCount).toBe(0);
    expect(r.pendingCount).toBe(0); // sí se desplegó, no es pendiente; solo se descarta del cálculo
  });

  it('fechas no parseables → el cambio se trata como pendiente', () => {
    const changes = [{ firstCommitAt: 'no-es-fecha', mergedAt: '2025-07-01T00:00:00Z' }];
    const deployments = [{ at: '2025-07-01T05:00:00Z', status: 'success' }];
    const r = leadTimeCommitToDeploy(changes, deployments);
    expect(r.deployedCount).toBe(0);
    expect(r.pendingCount).toBe(1);
  });

  it('entradas vacías o indefinidas → métricas nulas y contadores a cero', () => {
    for (const r of [leadTimeCommitToDeploy([], []), leadTimeCommitToDeploy(undefined, undefined)]) {
      expect(r.leadTimeHoursAvg).toBeNull();
      expect(r.leadTimeHoursMedian).toBeNull();
      expect(r.deployedCount).toBe(0);
      expect(r.pendingCount).toBe(0);
    }
  });

  it('cambios sin ningún despliegue registrado → todos pendientes', () => {
    const changes = [
      { firstCommitAt: '2025-08-01T00:00:00Z', mergedAt: '2025-08-02T00:00:00Z' },
      { firstCommitAt: '2025-08-03T00:00:00Z', mergedAt: '2025-08-04T00:00:00Z' },
    ];
    const r = leadTimeCommitToDeploy(changes, []);
    expect(r.leadTimeHoursAvg).toBeNull();
    expect(r.deployedCount).toBe(0);
    expect(r.pendingCount).toBe(2);
  });
});
