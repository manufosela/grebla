/**
 * Cliente de la interpretación IA de métricas (LEAN/DORA): lanzar una nueva
 * interpretación (Cloud Function `interpretMetrics`, solo superadmin) y leer la
 * VIGENTE guardada (`/interpretations/{tool}`, la ven todos). Espeja a lib/o2oAi.js.
 *
 * @typedef {import('./metricsInterpretation.js').Interpretation} Interpretation
 * @typedef {Interpretation & { at: string|null, by: { uid: string, name: string }|null }} SavedInterpretation
 */
import { sanitizeInterpretation } from './metricsInterpretation.js';

/** Sanea el núcleo y conserva la metadata de guardado (fecha y autor). */
export function withMeta(raw) {
  return { ...sanitizeInterpretation(raw), at: raw?.at ?? null, by: raw?.by ?? null };
}

/**
 * Lanza una interpretación nueva (la Function la persiste y la devuelve con fecha).
 * @param {{ tool: 'lean'|'dora', summary: object }} params
 * @returns {Promise<SavedInterpretation>}
 */
export async function interpretMetrics({ tool, summary }) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'interpretMetrics')({ tool, summary });
  const data = /** @type {{ interpretation: unknown }} */ (res.data);
  return withMeta(data?.interpretation);
}

/**
 * Lee la interpretación VIGENTE guardada de una herramienta (o null si no hay).
 * @param {{ tool: 'lean'|'dora' }} params
 * @returns {Promise<SavedInterpretation|null>}
 */
export async function loadInterpretation({ tool }) {
  const { db } = await import('./firebase.js');
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'interpretations', tool));
  if (!snap.exists()) return null;
  return withMeta(snap.data());
}
