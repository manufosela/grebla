/**
 * El plan de una persona (Mi carrera, RMR-TSK-0687). Dominio PURO.
 *
 * Lo escribe quien lleva a la persona (su cadena de managers) y lo lee ella:
 * en qué se centra, qué es suyo y qué suelta. Los compromisos del manager no
 * viven aquí: son las acciones del O2O que lleva el manager.
 *
 * @typedef {{ focus: string, responsibilities: string[], lettingGo: string[] }} CareerPlan
 */

export const MAX_PLAN_TEXT = 600;
export const MAX_PLAN_ITEMS = 15;

const text = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_PLAN_TEXT) : '');
const items = (v) => (Array.isArray(v) ? v.map(text).filter(Boolean).slice(0, MAX_PLAN_ITEMS) : []);

/**
 * @param {unknown} data  documento de Firestore (o el borrador del formulario)
 * @returns {CareerPlan}
 */
export function normalizePlan(data) {
  const d = /** @type {Record<string, unknown>} */ (data ?? {});
  return { focus: text(d.focus), responsibilities: items(d.responsibilities), lettingGo: items(d.lettingGo) };
}
