/**
 * Tramos de metadatos para segmentar sin exponer valores exactos (RMR-TSK-0318).
 * Dominio puro (sin Firebase). Guardar la antigüedad en TRAMOS (no la fecha de
 * alta) reduce el riesgo de reidentificación al cruzar segmentos.
 *
 * La fecha de referencia se pasa como argumento (no se lee el reloj aquí) para
 * que las funciones sean puras y testeables.
 */

/** Años (float) entre `startDateIso` y `refIso`; null si falta o no parsea; 0 si futura. */
export function tenureYears(startDateIso, refIso) {
  if (!startDateIso || !refIso) return null;
  const start = new Date(startDateIso);
  const ref = new Date(refIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(ref.getTime())) return null;
  const ms = ref.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return ms / (365.25 * 24 * 3600 * 1000);
}

/** Etiquetas de los tramos de antigüedad, en años. */
export const TENURE_BUCKETS = ['<1', '1-3', '3-5', '5-10', '10+'];

/** Tramo de antigüedad a partir de la fecha de alta y la de referencia. */
export function tenureBucket(startDateIso, refIso) {
  const years = tenureYears(startDateIso, refIso);
  if (years == null) return null;
  if (years < 1) return '<1';
  if (years < 3) return '1-3';
  if (years < 5) return '3-5';
  if (years < 10) return '5-10';
  return '10+';
}
