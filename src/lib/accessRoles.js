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

/**
 * Filtra los usuarios que aún NO están vinculados a ninguna persona. Puro (sin
 * Firestore): recibe la lista de usuarios (forma AccessUser con `uid`, o docs de
 * /users con `id`) y el conjunto de uids ya vinculados, y devuelve los que no
 * aparecen en ese conjunto. Alimenta el selector "Vincular cuenta" (líder) y la
 * acción "Asignar a equipo" (superadmin).
 * @param {ReadonlyArray<{ uid?: string, id?: string }>} users
 * @param {Iterable<string>} linkedUids  uids ya vinculados (Set o array).
 * @returns {Array<{ uid?: string, id?: string }>}
 */
export function unlinkedUsers(users, linkedUids) {
  const linked = linkedUids instanceof Set ? linkedUids : new Set(linkedUids);
  return (users ?? []).filter((u) => {
    const uid = u.uid ?? u.id;
    return uid != null && !linked.has(uid);
  });
}

/** @typedef {'gestion'|'manager'|'engineer'} ViewKey */

/**
 * Vistas entre las que un rol puede conmutar (RMR-TSK-0250 / RMR-BUG-0050). El
 * conmutador solo se muestra con 2+ vistas; con una sola, esa vista es la única
 * (marcada por defecto, sin alternar). Puro (sin Firestore) para poder testearlo.
 *  - superadmin: gestion (panel /admin) + manager (herramientas) + engineer.
 *    Las tres SIEMPRE: el superadmin tiene vista de toda la organización
 *    (`viewAll`) en cada tool, sea o no líder de un equipo propio.
 *  - supermanager (Head of X, RMR-TSK-0291): manager + engineer, igual que un
 *    líder ampliado. Opera y ve la rama de EMs que le reportan, pero NO
 *    administra la organización → sin «gestion».
 *  - leader (manager): manager + engineer.
 *  - viewer: solo gestion (sin conmutador).
 *  - engineer: solo su propio espacio.
 *  - sin rol: ninguna.
 * @param {'superadmin'|'supermanager'|'viewer'|'leader'|'engineer'|null} [role]
 * @returns {ViewKey[]}
 */
export function viewsForRole(role) {
  switch (role) {
    case 'superadmin': return ['gestion', 'manager', 'engineer'];
    case 'supermanager': return ['manager', 'engineer'];
    case 'leader': return ['manager', 'engineer'];
    case 'viewer': return ['gestion'];
    case 'engineer': return ['engineer'];
    default: return [];
  }
}

/**
 * uids de los líderes que cuelgan de un supermanager (Head of X), a partir de la
 * lista de líderes con su campo `reportsTo`. Puro (sin Firestore) para poder
 * testearlo. Define el «alcance de rama» del supermanager: las herramientas
 * (fase 2+) filtran los datos de equipo por estos uids, igual que un líder filtra
 * por el suyo. Varios Heads coexisten en paralelo, cada uno con su rama.
 *
 * Devuelve el CIERRE TRANSITIVO (RMR-TSK-0293): una organización real encadena
 * dirección → jefe de departamento → manager, así que la rama son todos los que
 * cuelgan a cualquier profundidad, no solo el primer salto. El recorrido lleva un
 * registro de visitados para terminar ante un ciclo accidental en los datos y no
 * devolver duplicados ni al propio supermanager.
 * @param {ReadonlyArray<{ uid?: string, id?: string, reportsTo?: string|null }>} leaders
 * @param {string} supermanagerUid
 * @returns {string[]} uids de la rama, en orden de cercanía (anchura)
 */
export function leadersReportingTo(leaders, supermanagerUid) {
  if (!supermanagerUid) return [];
  // Índice reportsTo → uids que le reportan directamente, en un solo recorrido.
  const directReports = new Map();
  for (const leader of leaders ?? []) {
    const uid = leader.uid ?? leader.id;
    if (uid == null || leader.reportsTo == null) continue;
    const reports = directReports.get(leader.reportsTo);
    if (reports) reports.push(uid);
    else directReports.set(leader.reportsTo, [uid]);
  }
  // Recorrido en anchura desde el supermanager. `seen` arranca con él mismo para
  // que un ciclo en los datos termine y no se incluya en su propia rama.
  const seen = new Set([supermanagerUid]);
  const branch = [];
  const pending = [supermanagerUid];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const uid of directReports.get(current) ?? []) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      branch.push(uid);
      pending.push(uid);
    }
  }
  return branch;
}
