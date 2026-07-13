/**
 * Cálculo de métricas de flujo (LEAN) de un equipo a partir de sus issues de
 * Linear (funciones puras): throughput, cycle time por percentiles (p50/p85),
 * WIP y aging. Flow efficiency llega en la Fase 2 (necesita historial de estados).
 *
 * @typedef {import('./types.js').FlowIssue} FlowIssue
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const round1 = (n) => Math.round(n * 10) / 10;
const ms = (d) => new Date(d).getTime();

/**
 * Percentil por interpolación lineal de una lista ordenada ascendente.
 * @param {number[]} sortedAsc  valores ordenados de menor a mayor
 * @param {number} p            percentil en [0, 1]
 * @returns {number|null}
 */
export function percentile(sortedAsc, p) {
  const list = Array.isArray(sortedAsc) ? sortedAsc : [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const idx = (list.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return list[lo];
  return list[lo] + (list[hi] - list[lo]) * (idx - lo);
}

/**
 * Métricas de flujo de un equipo en una ventana temporal.
 * @param {FlowIssue[]} issues
 * @param {{ from: string|number|Date, to: string|number|Date, now?: string|number|Date }} period
 * @returns {{ completed: number, throughputPerWeek: number, cycleTimeP50Hours: number|null, cycleTimeP85Hours: number|null, wip: number, agingDaysMax: number|null, agingDaysAvg: number }}
 */
export function computeFlowMetrics(issues, period) {
  const list = Array.isArray(issues) ? issues : [];
  const fromMs = ms(period.from);
  const toMs = ms(period.to);
  const nowMs = period.now == null ? toMs : ms(period.now);

  // Completadas DENTRO de la ventana (por completedAt).
  const completedIssues = list.filter(
    (i) => i.stateType === 'completed' && i.completedAt
      && ms(i.completedAt) >= fromMs && ms(i.completedAt) <= toMs,
  );
  const weeks = Math.max(1, (toMs - fromMs) / (7 * DAY));

  // Cycle time (h) = started→completed de las completadas con ambas marcas.
  const cycle = completedIssues
    .map((i) => (i.startedAt && i.completedAt ? (ms(i.completedAt) - ms(i.startedAt)) / HOUR : Number.NaN))
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);

  // WIP = issues en curso AHORA (started); aging = now − startedAt (días).
  const wipIssues = list.filter((i) => i.stateType === 'started');
  const agingDays = wipIssues
    .map((i) => (i.startedAt ? (nowMs - ms(i.startedAt)) / DAY : Number.NaN))
    .filter((d) => Number.isFinite(d) && d >= 0);

  // Las 3 issues EN CURSO más antiguas, para ir a desatascarlas (con enlace a
  // Linear). Sin responsable: es un reporte de equipo, no individual.
  const oldestWip = wipIssues
    .filter((i) => i.startedAt)
    .map((i) => ({ issue: i, days: (nowMs - ms(i.startedAt)) / DAY }))
    .filter((x) => Number.isFinite(x.days) && x.days >= 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, 3)
    .map((x) => ({
      identifier: x.issue.identifier ?? x.issue.id,
      url: x.issue.url ?? null,
      title: x.issue.title ?? '',
      agingDays: round1(x.days),
    }));

  const p50 = percentile(cycle, 0.5);
  const p85 = percentile(cycle, 0.85);

  return {
    completed: completedIssues.length,
    throughputPerWeek: round1(completedIssues.length / weeks),
    cycleTimeP50Hours: p50 == null ? null : round1(p50),
    cycleTimeP85Hours: p85 == null ? null : round1(p85),
    wip: wipIssues.length,
    agingDaysMax: agingDays.length ? round1(Math.max(...agingDays)) : null,
    agingDaysAvg: agingDays.length ? round1(agingDays.reduce((s, d) => s + d, 0) / agingDays.length) : 0,
    oldestWip,
  };
}
