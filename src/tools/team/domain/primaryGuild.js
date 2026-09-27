/**
 * Gremio PRINCIPAL de una persona (RMR-TSK-0594).
 *
 * Militar en dos gremios es normal y no se quiere prohibir: alguien de Frontend
 * que además está en QA aporta a los dos. El problema aparece al CONTAR: si esa
 * persona suma en Frontend y en QA, la suma por gremio sale mayor que la
 * plantilla y los totales no cuadran nunca. El gremio principal es el que manda
 * para contar; los demás quedan como contexto.
 *
 * La regla de oro aquí es que la falta de elección se DICE, no se adivina. Con
 * dos gremios y ninguno elegido, el principal es `null` y `needsPrimaryGuild`
 * lo saca a la luz: coger el primero de la lista sería inventarse la respuesta,
 * porque el orden de `guilds` no significa nada.
 */

/**
 * Un nombre de gremio recortado. Lo que no sea una cadena se descarta en vez de
 * convertirse: `String({})` daría «[object Object]», un gremio fantasma que
 * además se guardaría tal cual.
 * @param {unknown} v
 */
const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * El gremio principal que de verdad aplica, dada la lista de gremios actual.
 *
 * - Sin gremios → `null`: no hay de dónde elegir.
 * - Un solo gremio → ese. No es un fallback: no hay elección posible, así que
 *   pedirla sería preguntar por algo que ya se sabe.
 * - Varios y uno elegido que está en la lista → el elegido.
 * - Varios y el elegido ya no está entre sus gremios → `null`. Dejarlo contaría
 *   a la persona en un gremio al que ya no pertenece.
 * - Varios y ninguno elegido → `null`, está pendiente de decidir.
 *
 * @param {string[]|null|undefined} guilds
 * @param {string|null|undefined} primaryGuild
 * @returns {string|null}
 */
export function normalizePrimaryGuild(guilds, primaryGuild) {
  const list = (Array.isArray(guilds) ? guilds : []).map(clean).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const chosen = clean(primaryGuild);
  return list.includes(chosen) ? chosen : null;
}

/**
 * ¿A esta persona le falta elegir gremio principal? Solo cuando milita en más
 * de uno y no hay elección válida — lo demás no es un dato que falte.
 *
 * @param {{ guilds?: string[], primaryGuild?: string|null }} person
 * @returns {boolean}
 */
export function needsPrimaryGuild(person) {
  const list = (Array.isArray(person?.guilds) ? person.guilds : []).map(clean).filter(Boolean);
  return list.length > 1 && normalizePrimaryGuild(list, person?.primaryGuild) === null;
}

/**
 * Los gremios de una persona con el principal delante, para pintarlos: quien
 * mira la ficha ve primero el que cuenta. Los demás conservan su orden.
 *
 * @param {string[]|null|undefined} guilds
 * @param {string|null|undefined} primaryGuild
 * @returns {string[]}
 */
export function guildsOrdered(guilds, primaryGuild) {
  const list = (Array.isArray(guilds) ? guilds : []).map(clean).filter(Boolean);
  const primary = normalizePrimaryGuild(list, primaryGuild);
  if (!primary) return list;
  return [primary, ...list.filter((g) => g !== primary)];
}
