/**
 * Lógica pura de fusión/priorización de roles de acceso (sin dependencia de
 * Firestore, para poder testearla sin mockear nada). Usada por users.js, que
 * añade la capa de lectura/escritura contra /admins, /viewers, /leaders.
 *
 * @typedef {'superadmin'|'viewer'|'leader'} AccessRole
 * @typedef {{ uid: string, displayName: string|null, email: string|null, role: AccessRole }} AccessUser
 */

/** @type {Record<AccessRole, string>} */
export const ROLE_COLLECTION = { superadmin: 'admins', viewer: 'viewers', leader: 'leaders' };

/** Orden de prioridad (mayor a menor) para el rol mostrado si un uid apareciera en más de una colección. */
const ROLE_PRIORITY = /** @type {AccessRole[]} */ (['superadmin', 'viewer', 'leader']);

/**
 * Fusiona los docs de las tres colecciones de acceso en una lista de usuarios
 * únicos por uid. Si un uid apareciera en más de una colección (no debería:
 * cada alta borra de las demás, ver setUserRole), prioriza
 * superadmin > viewer > leader para el rol mostrado, sin borrar nada por su
 * cuenta.
 * @param {Record<AccessRole, Array<{ id: string, displayName?: string|null, email?: string|null }>>} byRole
 * @returns {AccessUser[]}
 */
export function mergeAccessUsers(byRole) {
  const byUid = new Map();
  // Se recorre en orden inverso de prioridad para que, al final, la entrada de
  // mayor prioridad (superadmin) sea la que quede en el Map si hay colisión.
  for (const role of [...ROLE_PRIORITY].reverse()) {
    for (const item of byRole[role] ?? []) {
      byUid.set(item.id, {
        uid: item.id,
        displayName: item.displayName ?? null,
        email: item.email ?? null,
        role,
      });
    }
  }
  return [...byUid.values()].sort((a, b) =>
    (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? ''),
  );
}
