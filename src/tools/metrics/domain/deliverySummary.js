/**
 * La foto de entrega, resuelta (RMR-TSK-0602).
 *
 * Convierte la respuesta del portal en las filas que la pantalla pinta, con la
 * decisión ya tomada en cada una: si hay número, si hay recuento, o si no hay
 * fuente. La pantalla no decide nada —pinta lo que diga `state`—, porque las
 * decisiones interesantes de estas métricas son justo las de no enseñar un
 * número, y ésas no pueden vivir repartidas por una plantilla.
 *
 * Los cuatro DORA salen SIEMPRE, incluidos los que no se pueden medir. Un hueco
 * que se dice es información —«falta registro de incidentes»— y un hueco que se
 * quita invita a que alguien lo rellene con la métrica de al lado.
 */
import { isMeasurable, rateDisplay } from './portalMetrics.js';

/** Por qué una fila enseña lo que enseña. La pantalla solo mira esto. */
export const ROW_STATES = Object.freeze({
  /** Hay medida. */
  valor: 'valor',
  /** Hay datos pero poca base: se dice el recuento en vez del porcentaje. */
  recuento: 'recuento',
  /** No hay fuente en absoluto para esta métrica en esta organización. */
  sinFuente: 'sin-fuente',
  /** Hay fuente, pero esta semana no hubo señal. */
  sinDato: 'sin-dato',
});

/** Por qué `changeFailureRate` y `timeToRestore` no se pueden medir hoy. */
const SIN_FUENTE_MOTIVO = 'falta registro de incidentes';

/** Una fila, con su decisión tomada. */
function row(label, state, { value = null, note = null, help = null } = {}) {
  return { label, state, value, note, help };
}

/**
 * La última semana de la serie es la foto: es la que la gente mira. Se devuelve
 * junto a las filas para poder decir si está a medias.
 * @param {{series: any[]}} metrics
 */
export function currentWeek(metrics) {
  return (metrics?.series ?? []).at(-1) ?? null;
}

/**
 * Las filas de la foto global.
 * @param {ReturnType<import('./portalMetrics.js').readPortalMetrics>} metrics
 */
export function deliverySummary(metrics) {
  const semana = currentWeek(metrics);
  if (!semana) return [];

  const filas = [];

  // 1. Frecuencia de despliegue. El número crudo, sin adornos.
  filas.push(semana.deploys === null
    ? row('Despliegues por semana', ROW_STATES.sinDato)
    : row('Despliegues por semana', ROW_STATES.valor, { value: String(semana.deploys) }));

  // 2. Fallo de DESPLIEGUE: que el despliegue se ejecutara. No es DORA, y por eso
  //    lleva su propia explicación pegada: sin ella se lee como fallo en producción.
  const tasa = rateDisplay(semana.deployFailureRate, semana.deploysConEstado, semana.deploysFallidos);
  const ayuda = 'Despliegues que no llegaron a ejecutarse. No es el fallo en producción: uno que falla al arrancar deja corriendo la versión anterior.';
  if (tasa.kind === 'rate') {
    filas.push(row('Fallo de despliegue', ROW_STATES.valor, {
      value: `${tasa.pct} %`, note: `${tasa.fails} de ${tasa.base} con señal`, help: ayuda,
    }));
  } else if (tasa.kind === 'count') {
    // Un «0 %» sobre un solo despliegue ocupa el mismo sitio y aparenta lo mismo
    // que un «0 %» sobre cincuenta.
    filas.push(row('Fallo de despliegue', ROW_STATES.recuento, {
      value: `${tasa.fails} de ${tasa.base}`, note: 'poca base para un porcentaje', help: ayuda,
    }));
  } else {
    filas.push(row('Fallo de despliegue', ROW_STATES.sinDato, {
      note: 'ningún despliegue con señal de estado', help: ayuda,
    }));
  }

  // 3 y 4. Los dos DORA que esta organización no puede medir. Salen igualmente:
  //        el hueco dicho es información; el hueco quitado se acaba rellenando.
  for (const [metric, label] of [['changeFailureRate', 'Fallo en producción'], ['timeToRestore', 'Tiempo de restauración']]) {
    filas.push(isMeasurable(metrics, metric)
      ? row(label, ROW_STATES.sinDato)
      : row(label, ROW_STATES.sinFuente, { note: SIN_FUENTE_MOTIVO }));
  }

  // 5 y 6. Flujo. Dos cuentas planas: el mismo trato para las dos.
  filas.push(...[['wip', 'Trabajo en curso'], ['throughput', 'Entregado por semana']]
    .map(([key, label]) => (semana[key] === null
      ? row(label, ROW_STATES.sinDato)
      : row(label, ROW_STATES.valor, { value: String(semana[key]) }))));

  return filas;
}

/**
 * Filas de un repo para la tabla de detalle.
 *
 * El lead time sale en HORAS, crudo: decidir si se dice en horas o en días es
 * presentación, y el dominio no elige unidades. Quien pinta ya tiene
 * `formatHours` para eso. Sin PRs revisadas no hay muestra, y eso es ausencia
 * —`null`— y no un cero: un «0 h» diría «entregan al instante», que es lo
 * contrario de «no lo sabemos».
 *
 * @param {{repo: string, series: any[]}} repo
 */
export function repoRowFor(repo) {
  const ultima = (repo?.series ?? []).at(-1) ?? null;
  return {
    repo: repo?.repo ?? '',
    parcial: ultima?.parcial === true,
    mergedPRs: ultima?.mergedPRs ?? null,
    reviewedPRs: ultima?.reviewedPRs ?? null,
    leadTimeMedianH: ultima?.leadTimeMedianH ?? null,
    leadTimeP85H: ultima?.leadTimeP85H ?? null,
  };
}

/**
 * Puntos de una sparkline, normalizados a una caja de 0..1. Devuelve `null`
 * cuando no hay con qué dibujar: una línea plana inventada con los huecos a cero
 * contaría una historia que no pasó.
 * @param {Array<Record<string, number|null>>} series
 * @param {string} key
 * @returns {{x: number, y: number}[]|null}
 */
export function sparkPoints(series, key) {
  const valores = (series ?? []).map((s) => s?.[key] ?? null);
  const medidos = valores.filter((v) => typeof v === 'number');
  if (medidos.length < 2) return null;
  const max = Math.max(...medidos);
  const min = Math.min(...medidos);
  const alto = max - min;
  const pasos = valores.length - 1;
  return valores
    .map((v, i) => (typeof v === 'number'
      // Con todos los valores iguales, la línea va por el medio y no por el suelo:
      // un cero visual diría «lo más bajo posible» y no es eso lo que pasó.
      ? { x: i / pasos, y: alto === 0 ? 0.5 : (v - min) / alto }
      : null))
    .filter((p) => p !== null);
}
