/**
 * Saneado de la interpretación de métricas que devuelve la IA (funciones puras).
 * La Cloud Function fuerza JSON con tool-use, pero el modelo puede devolver campos
 * vacíos o tipos raros: se normaliza a la forma que consume la UI.
 *
 * @typedef {{ verdict: 'bien'|'regular'|'mal', summary: string, causes: string[], recommendations: string[] }} Interpretation
 */
const VERDICTS = new Set(['bien', 'regular', 'mal']);
const clean = (v) => (typeof v === 'string' ? v : '').replaceAll(/\s+/g, ' ').trim().slice(0, 500);
const cleanList = (v) => (Array.isArray(v) ? v : []).map(clean).filter(Boolean).slice(0, 8);

/**
 * @param {unknown} raw  Lo que devuelve la función (input del tool-use).
 * @returns {Interpretation}
 */
export function sanitizeInterpretation(raw) {
  const obj = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    verdict: VERDICTS.has(obj.verdict) ? /** @type {'bien'|'regular'|'mal'} */ (obj.verdict) : 'regular',
    summary: clean(obj.summary),
    causes: cleanList(obj.causes),
    recommendations: cleanList(obj.recommendations),
  };
}
