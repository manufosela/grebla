/**
 * Lógica pura de fusión/priorización de roles de acceso (sin dependencia de
 * Firestore, para poder testearla sin mockear nada). Usada por users.js, que
 * añade la capa de lectura/escritura contra /admins, /viewers, /leaders.
 *
 * @typedef {'superadmin'|'viewer'|'leader'} AccessRole
 * @typedef {AccessRole|'none'} UserRole
 * @typedef {{ uid: string, displayName: string|null, email: string|null, role: UserRole, lastLogin: unknown }} AccessUser
 */

/** @type {Record<AccessRole, string>} */
export const ROLE_COLLECTION = { superadmin: 'admins', viewer: 'viewers', leader: 'leaders' };

/** Orden de prioridad (menor a mayor) para aplicar el rol si un uid apareciera en más de una colección. */
const ROLE_ASC = /** @type {AccessRole[]} */ (['leader', 'viewer', 'superadmin']);

/** Milisegundos de un valor lastLogin (Firestore Timestamp, número o null). */
function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

/**
 * Fusiona el directorio de usuarios (/users, todos los que han iniciado sesión)
 * con las colecciones de rol (/admins, /viewers, /leaders) en una única lista.
 * Cada usuario recibe su rol de mayor prioridad (superadmin > viewer > leader) o
 * 'none' si no tiene ninguno. Ordena por última conexión descendente.
 * @param {{ users?: Array<{id:string,displayName?:string|null,email?:string|null,lastLogin?:unknown}>,
 *           superadmin?: Array<{id:string,displayName?:string|null,email?:string|null}>,
 *           viewer?: Array<{id:string,displayName?:string|null,email?:string|null}>,
 *           leader?: Array<{id:string,displayName?:string|null,email?:string|null}> }} groups
 * @returns {AccessUser[]}
 */
export function mergeAccessUsers(groups) {
  const byUid = new Map();
  // Base: todos los usuarios registrados (aún sin rol).
  for (const u of groups.users ?? []) {
    byUid.set(u.id, {
      uid: u.id,
      displayName: u.displayName ?? null,
      email: u.email ?? null,
      lastLogin: u.lastLogin ?? null,
      role: /** @type {UserRole} */ ('none'),
    });
  }
  // Aplica los roles de menor a mayor prioridad (gana el último = mayor).
  for (const role of ROLE_ASC) {
    for (const item of groups[role] ?? []) {
      const existing = byUid.get(item.id);
      byUid.set(item.id, {
        uid: item.id,
        displayName: existing?.displayName ?? item.displayName ?? null,
        email: existing?.email ?? item.email ?? null,
        lastLogin: existing?.lastLogin ?? null,
        role,
      });
    }
  }
  return [...byUid.values()].sort((a, b) => toMs(b.lastLogin) - toMs(a.lastLogin));
}
