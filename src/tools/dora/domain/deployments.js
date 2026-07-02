/**
 * Frecuencia de despliegue REAL a partir de eventos de despliegue registrados
 * (función pura). A diferencia de `metrics.js` (que usa merges/releases como
 * PROXY), aquí se cuentan eventos de despliegue reales con estado 'success'
 * cuya marca de tiempo `at` cae dentro del periodo, divididos por el nº de
 * semanas del periodo (mín. 1). Misma convención de cálculo de semanas y
 * redondeo que `metrics.js` para que ambas frecuencias sean comparables.
 *
 * @typedef {import('./types.js').Deployment} Deployment
 * @typedef {{ from: string|number|Date, to: string|number|Date }} Period
 */
const HOUR = 3_600_000;
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Eventos con estado 'success' cuyo `at` cae dentro de [period.from, period.to]
 * (límites inclusivos). Se descartan los eventos con `at` no parseable.
 * @param {Deployment[]} events
 * @param {Period} period
 * @returns {Deployment[]}
 */
function successInWindow(events, period) {
  const list = Array.isArray(events) ? events : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();
  return list.filter((e) => {
    if (e?.status !== 'success') return false;
    const atMs = new Date(e.at).getTime();
    return Number.isFinite(atMs) && atMs >= fromMs && atMs <= toMs;
  });
}

/**
 * Nº total de despliegues reales (estado 'success') dentro de la ventana.
 * @param {Deployment[]} events
 * @param {Period} period
 * @returns {number}
 */
export function countDeployments(events, period) {
  return successInWindow(events, period).length;
}

/**
 * Frecuencia de despliegue REAL por semana: despliegues 'success' en la ventana
 * divididos por el nº de semanas del periodo (mín. 1), redondeado a 1 decimal.
 * @param {Deployment[]} events
 * @param {Period} period
 * @returns {number}
 */
export function deploymentFrequencyPerWeek(events, period) {
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();
  const weeks = Math.max(1, (toMs - fromMs) / (7 * 24 * HOUR));
  return round1(countDeployments(events, period) / weeks);
}
