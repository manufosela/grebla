/**
 * El plan de una persona (Mi carrera, RMR-TSK-0687). Dominio PURO.
 *
 * Lo escribe quien lleva a la persona (su cadena de managers) y lo lee ella:
 * en qué se centra, de qué se encarga, qué se espera de ella y qué no es su
 * foco. Los compromisos del manager no viven aquí: son las acciones del O2O.
 *
 * @typedef {{ focus: string, responsibilities: string[], expectations: string[], lettingGo: string[] }} CareerPlan
 */

export const MAX_PLAN_TEXT = 600;

const text = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_PLAN_TEXT) : '');
// Cada línea ya se pinta como elemento de lista: un guion delante sobra.
const item = (v) => text(v).replace(/^-\s*/, '');
const items = (v) => (Array.isArray(v) ? v.map(item).filter(Boolean) : []);

/**
 * @param {unknown} data  documento de Firestore (o el borrador del formulario)
 * @returns {CareerPlan}
 */
export function normalizePlan(data) {
  const d = /** @type {Record<string, unknown>} */ (data ?? {});
  return { focus: text(d.focus), responsibilities: items(d.responsibilities), expectations: items(d.expectations), lettingGo: items(d.lettingGo) };
}

/**
 * Una línea que acaba en dos puntos abre un apartado (Seguimiento:, Pendientes:…).
 * @param {string[]} lines
 * @returns {{ title: string, items: string[] }[]}  sin apartados vacíos
 */
export function planGroups(lines) {
  const groups = [{ title: '', items: [] }];
  for (const line of lines) {
    if (line.endsWith(':')) groups.push({ title: line.slice(0, -1), items: [] });
    else groups.at(-1).items.push(line);
  }
  return groups.filter((g) => g.items.length);
}
