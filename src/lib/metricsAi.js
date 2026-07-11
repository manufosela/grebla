/**
 * Cliente de la Cloud Function `interpretMetrics`: manda un resumen de métricas
 * (LEAN o DORA) a Claude y devuelve la interpretación saneada (veredicto, resumen,
 * causas, recomendaciones). Espeja a lib/o2oAi.js.
 *
 * @typedef {import('./metricsInterpretation.js').Interpretation} Interpretation
 */
import { sanitizeInterpretation } from './metricsInterpretation.js';

/**
 * @param {{ tool: 'lean'|'dora', summary: object }} params
 * @returns {Promise<Interpretation>}
 */
export async function interpretMetrics({ tool, summary }) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'interpretMetrics')({ tool, summary });
  const data = /** @type {{ interpretation: unknown }} */ (res.data);
  return sanitizeInterpretation(data?.interpretation);
}
