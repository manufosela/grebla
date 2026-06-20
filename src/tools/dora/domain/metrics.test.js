import { describe, it, expect } from 'vitest';
import { computeRepoMetrics } from './metrics.js';

describe('computeRepoMetrics', () => {
  it('lead time (media/mediana), despliegues y frecuencia', () => {
    const prs = [
      { createdAt: '2025-01-01T00:00:00Z', mergedAt: '2025-01-01T10:00:00Z' }, // 10h
      { createdAt: '2025-01-05T00:00:00Z', mergedAt: '2025-01-05T20:00:00Z' }, // 20h
      { createdAt: '2025-01-10T00:00:00Z', mergedAt: '2025-01-10T06:00:00Z' }, // 6h
    ];
    const m = computeRepoMetrics(prs, { from: '2025-01-01', to: '2025-01-29' }); // 4 semanas
    expect(m.deployments).toBe(3);
    expect(m.deployFrequencyPerWeek).toBe(0.8); // 3/4 = 0.75 → 0.8
    expect(m.leadTimeHoursAvg).toBe(12); // (10+20+6)/3
    expect(m.leadTimeHoursMedian).toBe(10); // ordenado [6,10,20]
  });

  it('sin PRs → métricas a cero/null', () => {
    const m = computeRepoMetrics([], { from: '2025-01-01', to: '2025-01-29' });
    expect(m.deployments).toBe(0);
    expect(m.deployFrequencyPerWeek).toBe(0);
    expect(m.leadTimeHoursAvg).toBeNull();
    expect(m.leadTimeHoursMedian).toBeNull();
  });
});
