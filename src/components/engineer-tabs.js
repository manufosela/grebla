/**
 * Lógica pura de las pestañas de «Mi espacio» (engineer-space): qué pestañas ve
 * cada persona. Un EXTERNO no tiene carrera/rolemirror/mapa: solo sus datos
 * básicos y sus O2O. Separado del componente para poder testearlo sin DOM.
 *
 * @typedef {{ external?: boolean }} PersonLike
 */

/** Pestañas visibles para un externo (sin carrera/rolemirror/mapa; ficha + motivadores + Marea + Retros). */
export const EXTERNAL_TABS = ['ficha', 'motivadores', 'o2o', 'marea', 'retros'];
/** Pestañas visibles para un interno (ficha primera + motivadores integrados). */
export const INTERNAL_TABS = ['ficha', 'carrera', 'rolemirror', 'mapa', 'motivadores', 'o2o', 'marea', 'retros'];

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
