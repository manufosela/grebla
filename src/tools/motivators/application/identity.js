/**
 * Construye la identidad de jugador a partir del acceso resuelto. Juegan
 * ingenieros y líderes: el ingeniero se identifica por su personId (equipo/líder =
 * su ownerLeaderUid); el líder por su uid (es su propio equipo). Superadmin/viewer
 * sin persona no juegan (devuelve null): administran o solo miran resultados.
 *
 * @typedef {import('../domain/types.js').PlayerIdentity} PlayerIdentity
 *
 * @param {{ role: string|null, uid: string|null, personId?: string }} access
 * @param {{ ownerLeaderUid?: string|null }|null} [person]  La persona del ingeniero (para su líder/equipo).
 * @returns {PlayerIdentity|null}
 */
export function buildPlayerIdentity(access, person = null) {
  if (!access?.uid) return null;
  if (access.role === 'engineer' && access.personId) {
    const owner = person?.ownerLeaderUid ?? null;
    return { usuarioId: access.personId, usuarioKind: 'person', uid: access.uid, liderId: owner, equipoId: owner };
  }
  if (access.role === 'leader') {
    return { usuarioId: access.uid, usuarioKind: 'leader', uid: access.uid, liderId: access.uid, equipoId: access.uid };
  }
  return null;
}
