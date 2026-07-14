/**
 * Construye la identidad de jugador a partir del acceso resuelto. Juega el equipo
 * al completo, incluido quien lidera (Moving Motivators es una reflexión personal: cada
 * cual mapea SUS motivadores, también el manager). El ingeniero se identifica por su
 * personId (equipo/líder = su ownerLeaderUid); el líder y el superadmin por su uid
 * (son su propio equipo). Solo el viewer (C-level observador) no juega: mira.
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
  if (access.role === 'leader' || access.role === 'superadmin') {
    return { usuarioId: access.uid, usuarioKind: 'leader', uid: access.uid, liderId: access.uid, equipoId: access.uid };
  }
  return null;
}
