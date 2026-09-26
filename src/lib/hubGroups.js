/**
 * GRUPOS del inicio (ADR «El inicio se agrupa por propósito», RMR-TSK-0575).
 *
 * Sustituye a las capas TRIBBU / Ingeniería. Aquellas separaban por A QUIÉN
 * SIRVE cada herramienta, que es una pregunta de gobierno del producto; quien
 * entra no busca «algo de TRIBBU», busca preparar un 1:1 o ver cómo va su
 * carrera. Los grupos responden a esa pregunta: para qué sirve.
 *
 * REGLA QUE SOSTIENE ESTE MÓDULO (heredada de las capas): los grupos se derivan
 * de las tarjetas que YA han quedado visibles tras aplicar políticas, ficha y
 * vista simulada. No se calculan aparte desde el rol. Calcularlos en paralelo
 * daría dos fuentes de verdad, y el síntoma sería un encabezado sin nada debajo
 * —que anuncia algo que no está— o uno que aparece al simular un rol que no lo
 * tiene, que miente con aspecto de verdad.
 *
 * Y no protegen: quien navegue directo por URL se topa igual con el gate de
 * página, la política de la herramienta y las reglas de Firestore.
 *
 * Puro: sin DOM ni Firebase.
 *
 * @typedef {{ id: string, label: string, hint: string }} HubGroup
 */

/**
 * Los grupos, en el orden en que se leen de arriba abajo.
 * @type {Readonly<Record<string, HubGroup>>}
 */
export const HUB_GROUPS = Object.freeze({
  tuyo: { id: 'tuyo', label: 'Lo tuyo', hint: 'Tu ficha, tu carrera y tus conversaciones.' },
  equipo: { id: 'equipo', label: 'Tu equipo', hint: 'Llevar a la gente que sostienes.' },
  estamos: { id: 'estamos', label: 'Cómo estamos', hint: 'El pulso del equipo y de la casa.' },
  entregamos: { id: 'entregamos', label: 'Cómo entregamos', hint: 'La salud de la entrega, nunca de una persona.' },
  casa: { id: 'casa', label: 'La casa', hint: 'Cómo se organiza y cómo trabajamos.' },
  // De cola: aquí caen las tarjetas a las que nadie asignó grupo. Existe para
  // que olvidarlo no esconda una herramienta.
  otras: { id: 'otras', label: 'Otras herramientas', hint: 'Todavía sin colocar.' },
});

/** Ids en orden de pintado. */
export const GROUP_IDS = Object.keys(HUB_GROUPS);

/** El grupo donde cae lo que no declara ninguno. */
export const FALLBACK_GROUP = 'otras';

/**
 * Grupo de una tarjeta. Lo que no exista cae en el de cola en vez de perderse.
 * @param {{ group?: string }|null|undefined} card
 * @returns {string}
 */
export function groupOf(card) {
  const id = card?.group;
  return typeof id === 'string' && id in HUB_GROUPS ? id : FALLBACK_GROUP;
}

/**
 * Los grupos que hay que pintar, a partir de los grupos de las tarjetas que HAN
 * QUEDADO VISIBLES. En orden, sin repetir y sin los que no existen.
 * @param {string[]|null|undefined} groupsWithVisibleCards
 * @returns {HubGroup[]}
 */
export function groupsWithCards(groupsWithVisibleCards) {
  const hay = new Set(groupsWithVisibleCards ?? []);
  return GROUP_IDS.filter((id) => hay.has(id)).map((id) => HUB_GROUPS[id]);
}
