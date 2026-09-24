/**
 * A quién se le puede definir el perfil en Role Mirror (RMR-TSK-0560).
 *
 * La herramienta es de INGENIERÍA: sus roles de contribución y su diagnóstico
 * hablan de cómo trabaja un equipo técnico. En la lista salía, en cambio, toda
 * persona del ámbito de quien mira —incluida la gente que entra a GREBLA y
 * todavía no está clasificada—, y ofrecer a alguien de otra rama no es solo
 * ruido: invita a rellenarle un perfil con un marco que no es el suyo.
 *
 * El día que Role Mirror sirva para otras ramas, esto es lo único que cambia.
 */

/** Ramas a las que hoy se les define perfil. */
export const ROLE_MIRROR_BRANCHES = Object.freeze(['engineering', 'engineering-manager']);

/**
 * ¿Entra esta persona en Role Mirror? Sin rama declarada, no: alguien recién
 * llegado y aún sin clasificar no debería aparecer en una lista de evaluación.
 * @param {{ orgBranch?: unknown }|null|undefined} person
 * @returns {boolean}
 */
export function inRoleMirrorScope(person) {
  return ROLE_MIRROR_BRANCHES.includes(String(person?.orgBranch ?? ''));
}

/**
 * Las personas a las que se les puede definir perfil, de la lista que ya trae
 * el ámbito de quien mira.
 * @template {{ orgBranch?: unknown }} P
 * @param {ReadonlyArray<P>|null|undefined} people
 * @returns {P[]}
 */
export function roleMirrorPeople(people) {
  return (people ?? []).filter((p) => inRoleMirrorScope(p));
}
