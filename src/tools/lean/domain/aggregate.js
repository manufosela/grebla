/**
 * Agregado de flujo del conjunto de equipos monitorizados: un resumen global.
 * Suma throughput, WIP y completadas; el cycle time global es media ponderada por
 * nº de completadas (aprox. honesta: no se pueden promediar percentiles sin sesgo).
 *
 * @typedef {import('./types.js').LeanTeam} LeanTeam
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {LeanTeam[]} teams  equipos con `metrics` calculadas
 * @returns {{ teams: number, completed: number, throughputPerWeek: number, wip: number, cycleTimeP50Hours: number|null, cycleTimeP85Hours: number|null, agingDaysMax: number|null, flowEfficiencyPct: number|null }}
 */
export function aggregateFlow(teams) {
  const withMetrics = (teams ?? []).filter((t) => t.metrics && !t.metrics.error);
  const sum = (field) => withMetrics.reduce((s, t) => s + (t.metrics[field] ?? 0), 0);
  const weighted = (field) => {
    const parts = withMetrics.filter((t) => t.metrics[field] != null && t.metrics.completed > 0);
    const totalW = parts.reduce((s, t) => s + t.metrics.completed, 0);
    if (!totalW) return null;
    return round1(parts.reduce((s, t) => s + t.metrics[field] * t.metrics.completed, 0) / totalW);
  };
  const agingMaxes = withMetrics.map((t) => t.metrics.agingDaysMax).filter((v) => v != null);
  return {
    teams: withMetrics.length,
    completed: sum('completed'),
    throughputPerWeek: round1(sum('throughputPerWeek')),
    wip: sum('wip'),
    cycleTimeP50Hours: weighted('cycleTimeP50Hours'),
    cycleTimeP85Hours: weighted('cycleTimeP85Hours'),
    agingDaysMax: agingMaxes.length ? Math.max(...agingMaxes) : null,
    flowEfficiencyPct: weighted('flowEfficiencyPct'),
  };
}
