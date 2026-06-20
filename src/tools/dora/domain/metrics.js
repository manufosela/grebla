/**
 * Cálculo de métricas DORA de un repo (función pura). A partir de los PRs
 * mergeados en el periodo: lead time (PR abierto→merge) medio/mediana, nº de
 * despliegues (proxy = merges) y frecuencia de despliegue por semana.
 *
 * @typedef {{ createdAt: string, mergedAt: string }} MergedPR
 */
const HOUR = 3_600_000;
const ms = (d) => new Date(d).getTime();
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {MergedPR[]} mergedPrs  PRs mergeados dentro del periodo
 * @param {{ from: string|number|Date, to: string|number|Date }} period
 * @returns {{ deployments: number, deployFrequencyPerWeek: number, leadTimeHoursAvg: number|null, leadTimeHoursMedian: number|null }}
 */
export function computeRepoMetrics(mergedPrs, period) {
  const list = Array.isArray(mergedPrs) ? mergedPrs : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();

  const lead = list
    .map((p) => (ms(p.mergedAt) - ms(p.createdAt)) / HOUR)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);

  const deployments = list.length;
  const weeks = Math.max(1, (toMs - fromMs) / (7 * 24 * HOUR));

  return {
    deployments,
    deployFrequencyPerWeek: round1(deployments / weeks),
    leadTimeHoursAvg: lead.length ? round1(lead.reduce((s, h) => s + h, 0) / lead.length) : null,
    leadTimeHoursMedian: lead.length ? round1(lead[Math.floor((lead.length - 1) / 2)]) : null,
  };
}
