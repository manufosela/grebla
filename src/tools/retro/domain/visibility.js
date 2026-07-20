/**
 * Visibilidad de las tarjetas de una retro (RMR-TSK-0283).
 *
 * Para que nadie copie ni se ancle en lo que ya han escrito los demás, las
 * tarjetas nacen OCULTAS: cada cual ve solo las suyas hasta que quien facilita
 * la retro revela una zona (o todas). El estado vive en la propia retro
 * (`revealed: { [columnId]: true }`) y no en cada cliente: revelar es un acto de
 * facilitación que debe verse a la vez en todas las pantallas.
 *
 * Ojo — esto es ocultación de FACILITACIÓN, no un secreto: el texto viaja al
 * cliente (las reglas dejan leer las notas a quien tiene acceso a la retro) y se
 * difumina en pantalla. Sirve para no anclar la conversación, no para proteger
 * datos de alguien decidido a mirar el tráfico.
 */

/**
 * ¿Está revelada esta zona/columna?
 *
 * En una retro CERRADA se ve siempre: ocultar solo tiene sentido mientras se
 * está aportando. Si no, una retro antigua quedaría ilegible para siempre.
 *
 * @param {{ status?: string, revealed?: Record<string, boolean>|null }|null} retro
 * @param {string} columnId
 * @returns {boolean}
 */
export function isColumnRevealed(retro, columnId) {
  if (!retro) return false;
  if (retro.status !== 'open') return true;
  return Boolean(retro.revealed?.[columnId]);
}

/**
 * ¿Están reveladas TODAS las zonas? Es la condición para abrir el Resumen
 * (RMR-TSK-0284): un resumen a medias sería una puerta trasera al contenido que
 * aún no se ha revelado, y una lista de líneas difuminadas no le sirve a nadie.
 *
 * @param {{ status?: string, revealed?: Record<string, boolean>|null }|null} retro
 * @param {ReadonlyArray<string>} columnIds
 * @returns {boolean}
 */
export function areAllRevealed(retro, columnIds) {
  return (columnIds ?? []).every((id) => isColumnRevealed(retro, id));
}

/**
 * ¿Puede este usuario leer el texto de esta tarjeta?
 *
 * Las propias SIEMPRE se leen: quien las escribió ya conoce su contenido, y
 * difuminárselas solo impediría releerlas o corregirlas.
 *
 * @param {{ columnId?: string, notes?: ReadonlyArray<{ authorUid?: string }> }} group
 * @param {string|null|undefined} uid
 * @param {{ status?: string, revealed?: Record<string, boolean>|null }|null} retro
 * @returns {boolean}
 */
export function canReadGroup(group, uid, retro) {
  if (isColumnRevealed(retro, group?.columnId)) return true;
  return Boolean(uid) && (group?.notes ?? []).some((n) => n.authorUid === uid);
}

/**
 * ¿Puede este usuario revelar/ocultar zonas? Solo quien facilita: el líder dueño
 * de la retro (o un superadmin, que ya puede escribir la retro por reglas).
 *
 * @param {{ ownerLeaderUid?: string }|null} retro
 * @param {string|null|undefined} uid
 * @param {boolean} [isSuperAdmin]
 * @returns {boolean}
 */
export function canReveal(retro, uid, isSuperAdmin = false) {
  if (!uid || !retro) return false;
  return isSuperAdmin || retro.ownerLeaderUid === uid;
}

/**
 * Parche para `updateDoc` que revela u oculta varias zonas de golpe. Se usan
 * claves con punto (`revealed.viento`) para no pisar el resto del mapa.
 *
 * @param {ReadonlyArray<string>} columnIds
 * @param {boolean} revealed
 * @returns {Record<string, boolean>}
 */
export function revealPatch(columnIds, revealed) {
  return Object.fromEntries((columnIds ?? []).filter(Boolean).map((id) => [`revealed.${id}`, revealed]));
}
