/**
 * Los 9 roles de Belbin (categorías de contribución, NO niveles). Por persona,
 * cada rol que ejerce se marca primario o secundario (ver scoring de cobertura
 * en services/roleCoverage.js). Catálogo de datos extensible.
 *
 * @typedef {'mental'|'social'|'action'} BelbinCategory
 * @typedef {Object} BelbinRole
 * @property {string} sigla   Clave en ContributionReading.roles
 * @property {string} name
 * @property {BelbinCategory} category
 */

/** @type {ReadonlyArray<BelbinRole>} */
export const BELBIN_ROLES = [
  { sigla: 'PL', name: 'Cerebro', category: 'mental' },
  { sigla: 'ME', name: 'Monitor evaluador', category: 'mental' },
  { sigla: 'SP', name: 'Especialista', category: 'mental' },
  { sigla: 'CO', name: 'Coordinador', category: 'social' },
  { sigla: 'RI', name: 'Investigador de recursos', category: 'social' },
  { sigla: 'TW', name: 'Cohesionador', category: 'social' },
  { sigla: 'SH', name: 'Impulsor', category: 'action' },
  { sigla: 'IMP', name: 'Implementador', category: 'action' },
  { sigla: 'CF', name: 'Finalizador', category: 'action' },
];

/** @type {ReadonlyArray<string>} */
export const BELBIN_SIGLAS = BELBIN_ROLES.map((r) => r.sigla);

/** @type {Readonly<Record<string, BelbinRole>>} */
export const BELBIN_BY_SIGLA = Object.freeze(Object.fromEntries(BELBIN_ROLES.map((r) => [r.sigla, r])));

/** Pesos de cobertura por tipo de ejercicio del rol (R9a). */
export const COVERAGE_WEIGHT = Object.freeze({ primary: 1.0, secondary: 0.5 });
