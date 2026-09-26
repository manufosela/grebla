/**
 * Lectura de las métricas del portal (RMR-TSK-0600).
 *
 * GREBLA dejó de calcular DORA y LEAN: las lee del portal, que es quien tiene las
 * fuentes. Este módulo traduce su respuesta a algo que una pantalla pueda pintar
 * sin tomar ni una decisión más.
 *
 * Tres reglas, y las tres vienen de errores que ya se cometieron una vez:
 *
 *  1. **Ausente no es cero.** Un campo que no viene sale `null`, y `null` se
 *     pinta con raya. Un cero se lee como una medida: «0 % de fallo» parece una
 *     semana perfecta cuando significa «esa semana nadie midió».
 *
 *  2. **Lo que está en `noMedible` no se rellena.** `noMedible` es una afirmación
 *     sobre la AUSENCIA DE FUENTE, no sobre el valor: ninguna métrica calculada
 *     puede satisfacer a otra que está en esa lista, porque si pudiera no estaría
 *     en la lista. `deployFailureRate` mide que el despliegue se ejecutara;
 *     `changeFailureRate` mide que lo desplegado rompiera producción. Ponerlo en
 *     su hueco pintaría un fallo EVITADO como un fallo ENTREGADO.
 *
 *  3. **Una tasa sin base no es una tasa.** Un 0 % sobre un solo despliegue con
 *     señal dice menos que el recuento crudo, y ocupa el mismo sitio aparentando
 *     lo mismo que un 0 % sobre cincuenta.
 */

/** La única forma de respuesta que este módulo sabe leer. */
export const SUPPORTED_SCHEMA = 1;

/**
 * Despliegues con señal por debajo de los cuales no se enseña porcentaje. Tres es
 * el punto en el que una tasa empieza a distinguirse de una anécdota; por debajo
 * se dice el recuento, que es más pequeño y más honesto.
 */
export const MIN_RATE_BASE = 3;

/**
 * Número si lo es de verdad; `null` en cualquier otro caso, incluido el campo que
 * no viene. Nunca convierte: convertir es lo que mete ceros donde no hubo medida.
 */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Texto si lo es de verdad; cadena vacía si no. Mismo criterio que `num`: un
 * `String(algo)` sobre un objeto escribe «[object Object]» en la pantalla, que es
 * un bug disfrazado de dato.
 */
function str(v) {
  return typeof v === 'string' ? v : '';
}

/**
 * Una fila de la serie global, con las ausencias dichas.
 * @param {Record<string, unknown>} row
 */
function globalRow(row) {
  const conEstado = num(row.deploysConEstado);
  return {
    periodStart: str(row.periodStart),
    periodEnd: str(row.periodEnd),
    // `parcial` manda; `days` queda de dato. Comparar `days` contra un 7 escrito a
    // mano se rompe el día que la granularidad sea mensual.
    parcial: row.parcial === true,
    days: num(row.days),
    deploys: num(row.deploys),
    deploysConEstado: conEstado,
    deploysFallidos: num(row.deploysFallidos),
    deployFailureRate: num(row.deployFailureRate),
    mergedPRs: num(row.mergedPRs),
    noReviewPRs: num(row.noReviewPRs),
    wip: num(row.wip),
    throughput: num(row.throughput),
  };
}

/** Una fila de la serie de un repo. El lead time viene o no viene; no se inventa. */
function repoRow(row) {
  return {
    periodStart: str(row.periodStart),
    periodEnd: str(row.periodEnd),
    parcial: row.parcial === true,
    mergedPRs: num(row.mergedPRs),
    reviewedPRs: num(row.reviewedPRs),
    leadTimeMedianH: num(row.leadTimeMedianH),
    leadTimeP85H: num(row.leadTimeP85H),
  };
}

/**
 * La respuesta del portal, lista para pintar.
 *
 * Una `schemaVersion` distinta FALLA: leer a medias una forma que no conoces
 * produce ceros silenciosos, que es la peor manera de enterarse de un cambio de
 * contrato —o de no enterarse nunca—.
 *
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function readPortalMetrics(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('El portal no devolvió métricas.');
  if (raw.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new Error(
      `El portal habla otra schemaVersion; esta versión de GREBLA lee la ${SUPPORTED_SCHEMA}.`,
    );
  }
  const noMedible = Array.isArray(raw.noMedible) ? raw.noMedible.filter((m) => typeof m === 'string') : [];
  const global = /** @type {Record<string, any>} */ (raw.global ?? {});
  const cobertura = /** @type {Record<string, any>} */ (global.coberturaDespliegues ?? {});
  return {
    dataUpdatedAt: str(raw.dataUpdatedAt) || null,
    calculatedAt: str(raw.calculatedAt) || null,
    granularity: str(raw.granularity) || 'weekly',
    noMedible,
    series: (global.series ?? []).map(globalRow),
    cobertura: {
      repos: (cobertura.repos ?? []).map(str),
      conEstado: (cobertura.conEstado ?? []).map(str),
      sinEstado: (cobertura.sinEstado ?? []).map(str),
      fueraDeCobertura: (global.fueraDeCobertura ?? []).map((f) => ({
        repo: str(f?.repo),
        motivo: str(f?.motivo),
      })),
    },
    repos: (raw.repos ?? []).map((r) => ({
      repo: str(r?.repo),
      series: (r?.series ?? []).map(repoRow),
    })),
  };
}

/**
 * ¿Hay fuente para esta métrica? Si está en `noMedible`, NO, y no hay número que
 * la sustituya. Esta es la función que impide que el hueco se rellene con la
 * métrica de al lado, y por eso existe en vez de ser un `includes` suelto en la
 * pantalla: un `includes` se olvida de poner, una función se ve en el diff.
 * @param {{ noMedible: string[] }} metrics
 * @param {string} metric
 */
export function isMeasurable(metrics, metric) {
  return !(metrics?.noMedible ?? []).includes(metric);
}

/**
 * Cómo enseñar una tasa: como porcentaje solo si hay base suficiente, y si no
 * como el recuento crudo con su denominador.
 *
 * Devuelve siempre la MISMA forma, con `kind` diciendo qué es. Una función que a
 * veces devuelve un número y a veces un texto obliga a quien la usa a adivinar.
 *
 * @param {number|null} rate
 * @param {number|null} base   despliegues con señal (el denominador real)
 * @param {number|null} fails  numerador, para poder decir el recuento
 * @returns {{ kind: 'rate'|'count'|'none', pct: number|null, fails: number|null, base: number|null }}
 */
export function rateDisplay(rate, base, fails) {
  if (base === null || base === 0) return { kind: 'none', pct: null, fails: null, base };
  if (base < MIN_RATE_BASE) return { kind: 'count', pct: null, fails, base };
  if (rate === null) return { kind: 'none', pct: null, fails, base };
  return { kind: 'rate', pct: Math.round(rate * 1000) / 10, fails, base };
}

/**
 * Repos cuyos despliegues se cuentan pero nunca pueden fallar, porque su fuente
 * no trae señal de estado. Merecen una frase en pantalla: si no, que la frecuencia
 * suba y la tasa de fallo no se mueva parece un misterio y es una explicación.
 * @param {{ cobertura: { sinEstado: string[] } }} metrics
 */
export function reposSinSenal(metrics) {
  return metrics?.cobertura?.sinEstado ?? [];
}
