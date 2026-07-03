/**
 * Mean Time to Recovery DORA D4 (función pura): tiempo medio que tarda el
 * servicio en recuperarse tras un incidente en producción. A partir de los
 * incidentes registrados manualmente (subcolección /dora/{repoId}/incidents),
 * espejo del registro de despliegues de D1:
 *
 *   MTTR = downtime total ÷ nº de incidentes resueltos
 *
 * Un incidente RESUELTO tiene `restoredAt` (fecha de restauración) no nulo; su
 * downtime = `restoredAt − startedAt`. Un incidente ABIERTO tiene `restoredAt`
 * null y NO entra en la media (aún no se ha recuperado), pero se reporta aparte.
 * Solo cuentan los resueltos cuyo `restoredAt` cae dentro del periodo (límites
 * inclusivos), misma convención de ventana y descarte de fechas no parseables
 * que `deployments.js`/`changeFailureRate.js`, para que las métricas DORA sean
 * comparables.
 *
 * Sin incidentes resueltos en la ventana → `mttrHoursAvg = null` (no medible):
 * NO se asume 0 h, que significaría "recuperación instantánea" y sería un
 * fallback silencioso engañoso.
 *
 * @typedef {import('./types.js').Incident} Incident
 * @typedef {{ from: string|number|Date, to: string|number|Date }} Period
 */
const HOUR = 3_600_000;
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Mean Time to Recovery del periodo.
 * @param {Incident[]} incidents  incidentes del repo
 * @param {Period} period
 * @returns {{ mttrHoursAvg: number|null, downtimeHoursTotal: number, resolvedCount: number, openCount: number }}
 */
export function meanTimeToRecovery(incidents, period) {
  const list = Array.isArray(incidents) ? incidents : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();

  let downtimeHoursTotal = 0;
  let resolvedCount = 0;
  let openCount = 0;

  for (const inc of list) {
    const restoredAt = inc?.restoredAt;
    // Abierto: sin fecha de restauración (null). Se reporta aparte, no en la media.
    if (restoredAt == null) {
      openCount += 1;
      continue;
    }
    // Resuelto: `restoredAt` debe caer en [from, to] (inclusivo). Fecha no
    // parseable o fuera de la ventana → se descarta (no cuenta como resuelto).
    const restoredMs = new Date(restoredAt).getTime();
    if (!Number.isFinite(restoredMs) || restoredMs < fromMs || restoredMs > toMs) continue;
    const startedMs = new Date(inc?.startedAt).getTime();
    const hours = (restoredMs - startedMs) / HOUR;
    // Descarta downtimes negativos o no finitos (restauración antes del inicio,
    // o `startedAt` no parseable): datos corruptos que falsearían la media.
    if (!Number.isFinite(hours) || hours < 0) continue;
    downtimeHoursTotal += hours;
    resolvedCount += 1;
  }

  return {
    mttrHoursAvg: resolvedCount > 0 ? round1(downtimeHoursTotal / resolvedCount) : null,
    downtimeHoursTotal: round1(downtimeHoursTotal),
    resolvedCount,
    openCount,
  };
}
