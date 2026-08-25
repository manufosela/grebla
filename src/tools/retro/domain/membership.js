/**
 * Quién puede ver una retro (RMR-TSK-0453, ADR «Retros por membresía»).
 *
 * Una retro es una conversación de un grupo, así que deja de pertenecer a un
 * manager y pasa a pertenecer a quienes están dentro. El documento lleva dos
 * campos, y las reglas de Firestore se anclan a los MISMOS que consulta el
 * listado — en Firestore las reglas no filtran: si consulta y regla no miran lo
 * mismo, o no se ve nada o se ve de más.
 *
 *  - `memberUids`: quienes han entrado. Crece cuando alguien abre el enlace.
 *  - `branchUids`: la cadena de managers de quien la convoca, copiada al crear.
 *    Es lo que hace que un manager vea las retros de su gente sin que le
 *    inviten. Es una FOTO del momento: si esa persona cambia de manager después,
 *    la retro conserva la cadena que tenía. Una retro es de su momento.
 *
 * Módulo puro: sin Firestore, sin fechas, sin azar.
 */

/** Quita vacíos y repetidos conservando el orden de aparición. */
const clean = (uids) => [...new Set((uids ?? []).filter((uid) => typeof uid === 'string' && uid.trim() !== ''))];

/**
 * Campos de acceso de una retro recién convocada.
 *
 * Quien convoca entra siempre como primer miembro: nadie crea una retro para no
 * estar en ella. Si no se sabe su cadena de managers —porque no tiene, o porque
 * el espejo de líderes aún no la ha calculado— la retro nace sin rama: la verán
 * quienes entren por el enlace, y ningún manager por el hecho de serlo. Es
 * preferible a inventarse una rama que dé acceso a quien no toca.
 *
 * @param {{ creatorUid: string, chain?: ReadonlyArray<string> }} input
 * @returns {{ memberUids: string[], branchUids: string[] }}
 */
export function accessFieldsForNewRetro({ creatorUid, chain } = {}) {
  if (typeof creatorUid !== 'string' || creatorUid.trim() === '') {
    throw new Error('Una retro necesita saber quién la convoca');
  }
  return {
    memberUids: [creatorUid],
    // El propio creador NO va en branchUids: ya está en memberUids, y mezclarlo
    // haría que «mi rama» y «donde estoy» dejaran de ser cosas distintas.
    branchUids: clean(chain).filter((uid) => uid !== creatorUid),
  };
}

/**
 * ¿Puede esta persona ver la retro?
 *
 * Espejo en JavaScript de lo que imponen las reglas de Firestore, para que la
 * interfaz no ofrezca lo que el servidor va a denegar. La autoridad son las
 * reglas: esto solo evita enseñar puertas cerradas.
 *
 * @param {{ memberUids?: ReadonlyArray<string>, branchUids?: ReadonlyArray<string> }} retro
 * @param {{ uid?: string|null, seesAll?: boolean }} viewer
 * @returns {boolean}
 */
export function canSeeRetro(retro, viewer) {
  if (viewer?.seesAll) return true;
  const uid = viewer?.uid;
  if (typeof uid !== 'string' || uid === '') return false;
  return (retro?.memberUids ?? []).includes(uid) || (retro?.branchUids ?? []).includes(uid);
}

/**
 * Añade a alguien a la lista de miembros. Idempotente a propósito: abrir el
 * enlace dos veces no puede duplicar ni reordenar nada.
 * @param {ReadonlyArray<string>} memberUids
 * @param {string} uid
 * @returns {string[]} la lista resultante (la de entrada si ya estaba)
 */
export function withMember(memberUids, uid) {
  const list = clean(memberUids);
  if (typeof uid !== 'string' || uid.trim() === '' || list.includes(uid)) return list;
  return [...list, uid];
}

/**
 * Saca a alguien de la lista de miembros (salir de una retro). Sus notas se
 * quedan: son del grupo, no suyas.
 * @param {ReadonlyArray<string>} memberUids
 * @param {string} uid
 * @returns {string[]}
 */
export function withoutMember(memberUids, uid) {
  return clean(memberUids).filter((member) => member !== uid);
}

/**
 * ¿Sirve este token para entrar en la retro? Comparación estricta y sin
 * atajos: un token vacío o ausente NO abre nada, aunque el documento tampoco
 * tenga uno guardado.
 * @param {{ joinToken?: unknown }} retro
 * @param {unknown} token
 * @returns {boolean}
 */
export function tokenOpens(retro, token) {
  const esperado = retro?.joinToken;
  return typeof esperado === 'string' && esperado !== ''
    && typeof token === 'string' && token === esperado;
}
