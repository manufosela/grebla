/**
 * Lógica pura de las pestañas de «Mi espacio» (engineer-space): qué pestañas ve
 * cada persona. Un EXTERNO no tiene carrera/rolemirror/mapa: solo sus datos
 * básicos y sus O2O. Separado del componente para poder testearlo sin DOM.
 *
 * @typedef {{ external?: boolean }} PersonLike
 */

/* Aquí solo va lo PROPIO de cada persona. Marea, Retros, Kudos y Motivadores
   salieron de estas listas (RMR-TSK-0459): son herramientas con su card en el
   hub, y tenerlas también aquí daba dos puertas a lo mismo y la sensación de
   estar en otra aplicación. */

/** Pestañas de un externo: no tiene carrera ni Role Mirror, solo sus datos y sus O2O. */
export const EXTERNAL_TABS = ['ficha', 'o2o', 'datos'];
/** Pestañas de un interno. «Carrera» integra nivel/expectativas y el mapa como
 *  sub-pestañas (RMR-TSK-0262): no hay pestaña «mapa» suelta. */
export const INTERNAL_TABS = ['ficha', 'carrera', 'rolemirror', 'o2o', 'datos'];

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
