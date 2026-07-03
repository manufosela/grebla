/**
 * Change Failure Rate DORA (función pura): porcentaje de despliegues a
 * producción que FALLAN (requieren remediación). A partir de los eventos de
 * despliegue registrados manualmente (D1), sobre los que caen dentro del
 * periodo:
 *
 *   CFR = fallidos / total × 100
 *
 * donde `total` = nº de eventos de despliegue en la ventana (success + failed)
 * y `failed` = nº de eventos con `status === 'failed'`. Todos los eventos son de
 * entorno 'production', así que no hay que filtrar por entorno. Misma convención
 * de ventana (límites inclusivos) y de descarte de fechas no parseables que
 * `deployments.js`, para que ambas métricas sean comparables.
 *
 * Sin despliegues en la ventana → `cfrPct = null` (no medible): NO se asume 0 %,
 * que significaría "todo correcto" y sería un fallback silencioso engañoso.
 *
 * @typedef {import('./types.js').Deployment} Deployment
 * @typedef {{ from: string|number|Date, to: string|number|Date }} Period
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Change Failure Rate del periodo.
 * @param {Deployment[]} deployments  eventos de despliegue del repo
 * @param {Period} period
 * @returns {{ cfrPct: number|null, failed: number, total: number }}
 */
export function changeFailureRate(deployments, period) {
  const list = Array.isArray(deployments) ? deployments : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();

  // Eventos dentro de [period.from, period.to] (límites inclusivos). Se descartan
  // los de `at` no parseable (misma regla que successInWindow en deployments.js).
  const inWindow = list.filter((e) => {
    const atMs = new Date(e?.at).getTime();
    return Number.isFinite(atMs) && atMs >= fromMs && atMs <= toMs;
  });

  const total = inWindow.length;
  const failed = inWindow.filter((e) => e?.status === 'failed').length;

  return {
    cfrPct: total > 0 ? round1((failed / total) * 100) : null,
    failed,
    total,
  };
}
