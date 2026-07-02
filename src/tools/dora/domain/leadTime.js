/**
 * Lead time DORA CANÓNICO (función pura): primer commit → despliegue en
 * producción. A diferencia de `metrics.js`, que usa el PROXY PR abierto→merge,
 * aquí se casa cada cambio (PR) con el PRIMER evento de despliegue real
 * ('success') posterior a su merge y se mide desde su primer commit.
 *
 * Un cambio cuyo merge todavía no ha llegado a un despliegue en producción está
 * PENDIENTE: no aporta al lead time (aún no ha completado el recorrido).
 *
 * @typedef {{ firstCommitAt: string, mergedAt: string }} Change
 * @typedef {{ at: string, status: string }} DeployEvent
 */
const HOUR = 3_600_000;
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Casa cada cambio con el despliegue que lo llevó a producción y calcula el
 * lead time real (commit→deploy).
 *
 * Reglas de casación:
 *  - Solo cuentan despliegues con `status === 'success'`.
 *  - A un cambio le corresponde el PRIMER despliegue success cuyo `at >= mergedAt`.
 *  - Sin despliegue posterior → cambio PENDIENTE (no entra en el lead time).
 *  - Lead time negativo o no finito (fechas inconsistentes) → se descarta.
 *
 * @param {Change[]} changes  cambios (PRs) con su primer commit y su merge
 * @param {DeployEvent[]} deployments  eventos de despliegue reales del repo
 * @returns {{ leadTimeHoursAvg: number|null, leadTimeHoursMedian: number|null, deployedCount: number, pendingCount: number }}
 */
export function leadTimeCommitToDeploy(changes, deployments) {
  const changeList = Array.isArray(changes) ? changes : [];
  const deployList = Array.isArray(deployments) ? deployments : [];

  // Marcas de tiempo de los despliegues 'success', ordenadas ascendente para
  // localizar el PRIMER despliegue posterior al merge de cada cambio.
  const successAtMs = deployList
    .filter((d) => d?.status === 'success')
    .map((d) => new Date(d.at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const leadHours = [];
  let pendingCount = 0;

  for (const change of changeList) {
    const mergedMs = new Date(change?.mergedAt).getTime();
    const firstCommitMs = new Date(change?.firstCommitAt).getTime();
    // Sin fechas parseables no se puede casar: se trata como pendiente.
    if (!Number.isFinite(mergedMs) || !Number.isFinite(firstCommitMs)) {
      pendingCount += 1;
      continue;
    }
    // Primer despliegue success que ocurre en o después del merge.
    const deployAtMs = successAtMs.find((t) => t >= mergedMs);
    if (deployAtMs === undefined) {
      pendingCount += 1;
      continue;
    }
    const hours = (deployAtMs - firstCommitMs) / HOUR;
    // Negativos/no finitos = datos inconsistentes: se descartan del cálculo.
    if (Number.isFinite(hours) && hours >= 0) leadHours.push(hours);
  }

  leadHours.sort((a, b) => a - b);
  const deployedCount = leadHours.length;

  return {
    leadTimeHoursAvg: deployedCount ? round1(leadHours.reduce((s, h) => s + h, 0) / deployedCount) : null,
    // Mediana baja (misma convención que metrics.js): en longitud par toma el
    // valor central inferior para que ambas medianas sean comparables.
    leadTimeHoursMedian: deployedCount ? round1(leadHours[Math.floor((deployedCount - 1) / 2)]) : null,
    deployedCount,
    pendingCount,
  };
}
