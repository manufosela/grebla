/**
 * Referencia de Linear de una votación (RMR-TSK-0518). Dominio puro.
 *
 * El organizador escribe «bb-1234» o «BB-1234 » y se guarda BB-1234; lo que
 * no tenga forma de identificador no llega ni a la Cloud Function.
 */

/** Identificador de Linear: equipo en mayúsculas, guion y número (BB-1234). Espejo de functions/linearIssue.js. */
export const LINEAR_REF_RE = /^[A-Z][A-Z0-9]{1,7}-\d{1,6}$/;

/**
 * Normaliza lo escrito: mayúsculas y sin espacios. Devuelve '' si está vacío
 * (quitar la referencia) y null si no es una referencia.
 * @param {unknown} input
 * @returns {string|null}
 */
export function normalizeLinearRef(input) {
  const ref = String(input ?? '').trim().toUpperCase();
  if (ref === '') return '';
  return LINEAR_REF_RE.test(ref) ? ref : null;
}
