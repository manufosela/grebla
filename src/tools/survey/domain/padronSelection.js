/**
 * A quién se envía una encuesta desde el padrón (RMR-TSK-0629): por defecto a
 * todas las personas de la lista (filtrada por departamento y activas); quien
 * la gestiona desmarca a quien no. Puro.
 */

/**
 * Lo que queda tras desmarcar: `excluded` son los emails (en minúsculas) quitados.
 * @template {{ email: string }} P
 * @param {P[]} participants @param {Set<string>} excluded
 * @returns {P[]}
 */
export function withoutExcluded(participants, excluded) {
  return participants.filter((p) => !excluded.has(p.email.toLowerCase()));
}
