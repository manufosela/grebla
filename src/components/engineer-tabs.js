/**
 * Lógica pura de las pestañas de «Mi espacio» (engineer-space): qué pestañas ve
 * cada persona. Un EXTERNO no tiene carrera/rolemirror/mapa: solo sus datos
 * básicos y sus O2O. Separado del componente para poder testearlo sin DOM.
 *
 * @typedef {{ external?: boolean }} PersonLike
 */

/** Pestañas visibles para un externo (no tiene carrera/rolemirror/mapa; Marea sí). */
export const EXTERNAL_TABS = ['datos', 'o2o', 'marea'];
/** Pestañas visibles para un interno (las de siempre + Marea). */
export const INTERNAL_TABS = ['carrera', 'rolemirror', 'mapa', 'o2o', 'marea'];

/**
 * Pestañas visibles según el tipo de persona.
 * @param {PersonLike|null|undefined} person
 * @returns {string[]}
 */
export function visibleTabsFor(person) {
  return person?.external ? EXTERNAL_TABS : INTERNAL_TABS;
}

/**
 * Pestaña efectiva: la activa si es visible, o la primera visible (p. ej. un
 * externo con `#carrera` en el hash cae en «datos»).
 * @param {string} tab
 * @param {PersonLike|null|undefined} person
 * @returns {string}
 */
export function effectiveTabFor(tab, person) {
  const visible = visibleTabsFor(person);
  return visible.includes(tab) ? tab : visible[0];
}
