/**
 * k-anonimato para los resultados de la encuesta (RMR-TSK-0318). Dominio puro.
 *
 * Regla: no se muestra ningún segmento (un cruce de metadatos, p. ej.
 * departamento × tramo de antigüedad) con menos de N respuestas — evita
 * reidentificar en cruces pequeños. N por defecto = 5 (decidido por People).
 */

export const DEFAULT_THRESHOLD = 5;

/** ¿Se puede mostrar un segmento con `count` respuestas? */
export function isSegmentVisible(count, threshold = DEFAULT_THRESHOLD) {
  return Number.isFinite(count) && count >= threshold;
}

/** Deja solo los segmentos visibles (>= N). `segments`: [{ key?, count, ... }]. */
export function suppressSmall(segments, threshold = DEFAULT_THRESHOLD) {
  return (segments ?? []).filter((s) => isSegmentVisible(s?.count, threshold));
}

/**
 * Reparte los segmentos en `{ visible, suppressed }` para poder informar «N
 * segmentos ocultos por privacidad» sin revelar cuáles.
 */
export function partitionSegments(segments, threshold = DEFAULT_THRESHOLD) {
  const visible = [];
  const suppressed = [];
  for (const s of segments ?? []) {
    (isSegmentVisible(s?.count, threshold) ? visible : suppressed).push(s);
  }
  return { visible, suppressed };
}
