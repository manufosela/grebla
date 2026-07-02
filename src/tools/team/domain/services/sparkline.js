/**
 * Geometría pura de un sparkline (line chart) para series de nivel 1..7.5.
 * No toca el DOM ni Lit: dado un array de valores numéricos y unas dimensiones,
 * devuelve las coordenadas de cada punto y la cadena `points` de un `<polyline>`.
 * La vista se limita a pintar el SVG con estos datos. Función pura y testeable.
 *
 * El eje Y se invierte (en SVG la Y crece hacia abajo): a mayor valor, menor `y`.
 * El rango por defecto es la escala GREBLA con margen superior para el tránsito
 * a Magister (7.5), coherente con `levelToNumber`.
 */

/** Límite inferior por defecto del eje Y (nivel Tiro). */
export const SPARK_MIN = 1;
/** Límite superior por defecto del eje Y (Magister + tránsito). */
export const SPARK_MAX = 7.5;

/**
 * @typedef {Object} SparkPoint
 * @property {number} index  Posición en la serie (0-based).
 * @property {number} value  Valor original ya acotado al rango [min, max].
 * @property {number} x      Coordenada X en unidades del viewBox.
 * @property {number} y      Coordenada Y en unidades del viewBox (invertida).
 */

/**
 * @typedef {Object} SparklineGeometry
 * @property {SparkPoint[]} points   Puntos de la serie con sus coordenadas.
 * @property {string} polyline       Atributo `points` listo para `<polyline>`.
 * @property {number} width          Ancho del viewBox.
 * @property {number} height         Alto del viewBox.
 * @property {number} min            Límite inferior efectivo del eje Y.
 * @property {number} max            Límite superior efectivo del eje Y.
 */

/**
 * Calcula la geometría de un sparkline a partir de una serie de valores.
 *
 * @param {ReadonlyArray<{ value: number }>} series  Lecturas en orden temporal ascendente.
 * @param {Object} [opts]
 * @param {number} [opts.width=300]    Ancho del viewBox en unidades de usuario.
 * @param {number} [opts.height=120]   Alto del viewBox en unidades de usuario.
 * @param {number} [opts.padding=10]   Margen interior en todos los lados.
 * @param {number} [opts.min=SPARK_MIN] Límite inferior del eje Y.
 * @param {number} [opts.max=SPARK_MAX] Límite superior del eje Y.
 * @returns {SparklineGeometry}
 */
export function sparkline(series, opts = {}) {
  const width = opts.width ?? 300;
  const height = opts.height ?? 120;
  const padding = opts.padding ?? 10;
  const min = opts.min ?? SPARK_MIN;
  const max = opts.max ?? SPARK_MAX;

  // Rango degenerado (min === max) haría dividir por cero: se trata como plano.
  const span = max - min;
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const list = Array.isArray(series) ? series : [];
  const n = list.length;

  const points = list.map((item, index) => {
    const raw = Number(item?.value);
    const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
    // Un único punto se centra; con dos o más se reparte por el ancho útil.
    const x = n <= 1 ? padding + innerW / 2 : padding + (index / (n - 1)) * innerW;
    // t = 0 en el mínimo (abajo), 1 en el máximo (arriba); Y invertida.
    const t = span === 0 ? 0.5 : (value - min) / span;
    const y = padding + (1 - t) * innerH;
    return {
      index,
      value,
      x: round(x),
      y: round(y),
    };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  return { points, polyline, width, height, min, max };
}

/**
 * Tendencia global de una serie comparando la primera y la última lectura.
 * @param {ReadonlyArray<{ value: number }>} series
 * @returns {'ascendente'|'descendente'|'estable'}
 */
export function sparklineTrend(series) {
  const list = Array.isArray(series) ? series : [];
  if (list.length < 2) return 'estable';
  const first = Number(list.at(0)?.value);
  const last = Number(list.at(-1)?.value);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === last) return 'estable';
  return last > first ? 'ascendente' : 'descendente';
}

/**
 * Redondea a 2 decimales para SVG compacto sin arrastre de coma flotante.
 * @param {number} value
 * @returns {number}
 */
function round(value) {
  return Math.round(value * 100) / 100;
}
