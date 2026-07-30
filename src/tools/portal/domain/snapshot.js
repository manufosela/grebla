/**
 * Dominio del PUSH de métricas al portal de management (RMR-TSK-0352). Puro (sin
 * Firebase): mapea las métricas que GREBLA ya calcula (DORA por equipo, LEAN por
 * squad) al ESQUEMA EXACTO que el portal lee, con las unidades correctas, y
 * acumula la serie semanal snapshot a snapshot.
 *
 * Unidades del portal (obligatorio):
 *  - leadTimeForChanges, timeToRestore, cycleTime → HORAS
 *  - changeFailureRate, flowEfficiency           → fracción 0..1
 *  - deploymentFrequency, throughput             → número por semana
 *  - wip                                          → entero
 */

const SERIES_CAP = 8; // ~6-8 periodos semanales

/** Slug estable de un squad: minúsculas, sin diacríticos, no-alfanumérico → «-». */
export function slugifySquad(name) {
  return String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** Número finito o `null` (no inventa 0 para datos ausentes). */
const numOrNull = (v) => (Number.isFinite(v) ? v : null);
/** Entero finito o `null`. */
const intOrNull = (v) => (Number.isInteger(v) ? v : (Number.isFinite(v) ? Math.round(v) : null));
/** Porcentaje 0..100 → fracción 0..1 (4 decimales); `null`/no numérico → `null`. */
const fractionFromPct = (pct) => (Number.isFinite(pct) ? Math.round((pct / 100) * 10000) / 10000 : null);

/**
 * ¿Falló el cálculo de este squad? (no publicar snapshots a medias). Un objeto de
 * métricas con `.error` o ausente cuenta como fallo.
 */
export function calcFailed(metrics) {
  return !metrics || typeof metrics === 'string' || typeof metrics.error === 'string';
}

/** `current` DORA en el esquema del portal, con unidades convertidas. */
export function doraCurrent(agg) {
  return {
    deploymentFrequency: numOrNull(agg?.deployFrequencyPerWeek),
    leadTimeForChanges: numOrNull(agg?.leadTimeCommitDeployHoursAvg ?? agg?.leadTimeHoursAvg),
    changeFailureRate: fractionFromPct(agg?.changeFailureRatePct),
    timeToRestore: numOrNull(agg?.mttrHoursAvg),
  };
}

/** `current` LEAN en el esquema del portal. `flowEfficiency` aún no lo calcula GREBLA → null. */
export function leanCurrent(metrics) {
  return {
    cycleTime: numOrNull(metrics?.cycleTimeP50Hours),
    throughput: numOrNull(metrics?.throughputPerWeek),
    wip: intOrNull(metrics?.wip),
    flowEfficiency: numOrNull(metrics?.flowEfficiency),
  };
}

/** ¿El `current` tiene al menos un número real? (si todo es null, no hay nada que publicar). */
export function hasAnyNumber(current) {
  return Object.values(current ?? {}).some((v) => Number.isFinite(v));
}

/**
 * Acumula la serie: reemplaza el punto de la MISMA semana (idempotente), ordena
 * por `periodStart` y conserva los últimos `cap` (~8) periodos.
 */
export function accumulateSeries(prevSeries, point, cap = SERIES_CAP) {
  const kept = (Array.isArray(prevSeries) ? prevSeries : [])
    .filter((p) => p && typeof p.periodStart === 'string' && p.periodStart !== point.periodStart);
  return [...kept, point]
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0))
    .slice(-cap);
}

/**
 * Ensambla el documento del portal (`metrics_dora/{slug}` o `metrics_lean/{slug}`)
 * respetando el esquema campo a campo. `prevSeries` es la serie del doc anterior
 * del portal (para acumular). El punto de la serie es la semana `periodStart`.
 */
export function buildSnapshot({ squad, updatedAt, periodStart, current, prevSeries, period = 'weekly' }) {
  const point = { periodStart, ...current };
  return {
    squad,
    updatedAt,
    period,
    current,
    series: accumulateSeries(prevSeries, point),
  };
}
