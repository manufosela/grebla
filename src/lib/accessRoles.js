/**
 * Lógica pura de fusión/priorización de roles de acceso (sin dependencia de
 * Firestore, para poder testearla sin mockear nada). Usada por users.js, que
 * añade la capa de lectura/escritura contra /admins, /viewers, /leaders.
 *
 * @typedef {'superadmin'|'supermanager'|'viewer'|'leader'} AccessRole
 * @typedef {AccessRole|'none'} UserRole
 * @typedef {'supermanager'|'viewer'|'leader'|'none'} TeamRole  Rol de equipo (eje funcional), sin el gobierno.
 * @typedef {{ uid: string, displayName: string|null, email: string|null, role: UserRole,
 *   teamRole: TeamRole, isAdmin: boolean, lastLogin: unknown }} AccessUser
 */

/** @type {Record<AccessRole, string>} */
export const ROLE_COLLECTION = {
  superadmin: 'admins',
  // El Head of X (RMR-TSK-0295): sin esta entrada, setUserRole no sabía
  // concederlo y el rol solo se podía dar creando el doc a mano en Firestore.
  supermanager: 'supermanagers',
  viewer: 'viewers',
  leader: 'leaders',
};

/** Orden de prioridad (menor a mayor) para aplicar el rol si un uid apareciera en más de una colección. */
const ROLE_ASC = /** @type {AccessRole[]} */ (['leader', 'viewer', 'supermanager', 'superadmin']);

/** Milisegundos de un valor lastLogin (Firestore Timestamp, número o null). */
function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

/**
 * Fusiona el directorio de usuarios (/users, todos los que han iniciado sesión)
 * con las colecciones de rol en una única lista. Expone los DOS EJES por usuario
 * (ADR de acceso en dos ejes): `isAdmin` (gobierno de instancia, /admins) y
 * `teamRole` (rol de equipo: supermanager/viewer/leader/none), independientes. El
 * `role` único derivado se mantiene por compatibilidad. Ordena por última conexión.
 * @param {{ users?: Array<{id:string,displayName?:string|null,email?:string|null,lastLogin?:unknown}>,
 *           superadmin?: Array<{id:string,displayName?:string|null,email?:string|null}>,
 *           supermanager?: Array<{id:string,displayName?:string|null,email?:string|null}>,
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
      teamRole: /** @type {TeamRole} */ ('none'),
      isAdmin: false,
      isSurveyAdmin: false,
    });
  }
  // Aplica los roles de menor a mayor prioridad (gana el último = mayor). El
  // superadmin marca el eje de gobierno (isAdmin) sin pisar el rol de equipo.
  for (const role of ROLE_ASC) {
    for (const item of groups[role] ?? []) {
      const existing = byUid.get(item.id) ?? {
        uid: item.id, displayName: null, email: null, lastLogin: null,
        role: 'none', teamRole: 'none', isAdmin: false, isSurveyAdmin: false,
      };
      const next = {
        ...existing,
        uid: item.id,
        displayName: existing.displayName ?? item.displayName ?? null,
        email: existing.email ?? item.email ?? null,
        role, // derivado: el de mayor prioridad (incluye superadmin)
      };
      if (role === 'superadmin') next.isAdmin = true;
      else next.teamRole = /** @type {TeamRole} */ (role);
      byUid.set(item.id, next);
    }
  }
  // Gestor de encuestas (People): eje ortogonal, como el gobierno (isAdmin).
  for (const item of groups.surveyAdmin ?? []) {
    const existing = byUid.get(item.id) ?? {
      uid: item.id, displayName: null, email: null, lastLogin: null,
      role: 'none', teamRole: 'none', isAdmin: false, isSurveyAdmin: false,
    };
    byUid.set(item.id, {
      ...existing, uid: item.id,
      displayName: existing.displayName ?? item.displayName ?? null,
      email: existing.email ?? item.email ?? null,
      isSurveyAdmin: true,
    });
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
/** @typedef {{ functionalRole?: import('./access.js').FunctionalRole, instanceAccess?: import('./access.js').InstanceAccess }} AccessAxes */

/** ¿Ve toda la organización? Tanto admin (gobierna) como viewer (C-level) la ven.
 * @param {AccessAxes} access @returns {boolean} */
export function viewAll(access) {
  return (access?.instanceAccess ?? null) !== null;
}

/** ¿Gobierna la instancia (catálogos, roles, panel)? Solo el admin.
 * @param {AccessAxes} access @returns {boolean} */
export function canGovern(access) {
  return access?.instanceAccess === 'admin';
}

/**
 * Vistas entre las que un usuario puede conmutar (RMR-TSK-0250 / RMR-BUG-0050),
 * derivadas de sus DOS EJES (RMR-TSK-0304). El conmutador solo se muestra con 2+
 * vistas. Puro (sin Firestore) para poder testearlo.
 *  - «gestion» (panel): si tiene gobierno de instancia (admin gestiona, viewer
 *    observa en solo lectura).
 *  - «manager» (herramientas): si su rol funcional es leader/supermanager (opera
 *    su equipo o su rama) o es admin (ve toda la organización).
 *  - «engineer» (su espacio): si tiene cualquier rol funcional (su ficha, o
 *    preview siendo manager/head) o es admin.
 * El orden es fijo: gestion, manager, engineer.
 * @param {AccessAxes} access
 * @returns {ViewKey[]}
 */
export function viewsFor(access) {
  const functionalRole = access?.functionalRole ?? null;
  const isAdmin = access?.instanceAccess === 'admin';
  /** @type {ViewKey[]} */
  const views = [];
  if (viewAll(access)) views.push('gestion');
  if (functionalRole === 'leader' || functionalRole === 'supermanager' || isAdmin) views.push('manager');
  if (functionalRole !== null || isAdmin) views.push('engineer');
  return views;
}

/**
 * Wrapper de compatibilidad: vistas a partir del rol único derivado. Se mantiene
 * mientras haya consumidores del modelo antiguo; delega en `viewsFor` mapeando el
 * rol a sus ejes, así que su salida es idéntica a la histórica.
 * @param {'superadmin'|'supermanager'|'viewer'|'leader'|'engineer'|null} [role]
 * @returns {ViewKey[]}
 */
export function viewsForRole(role) {
  switch (role) {
    case 'superadmin': return viewsFor({ instanceAccess: 'admin', functionalRole: null });
    case 'supermanager': return viewsFor({ instanceAccess: null, functionalRole: 'supermanager' });
    case 'leader': return viewsFor({ instanceAccess: null, functionalRole: 'leader' });
    case 'viewer': return viewsFor({ instanceAccess: 'viewer', functionalRole: null });
    case 'engineer': return viewsFor({ instanceAccess: null, functionalRole: 'engineer' });
    default: return [];
  }
}

/**
 * @typedef {'engineer'|'leader'|'supermanager'|null} FunctionalRole
 * @typedef {'admin'|'viewer'|null} InstanceAccess
 */

/**
 * Deriva los DOS EJES ORTOGONALES del acceso (ADR de acceso en dos ejes,
 * RMR-PCS-0024) a partir de la pertenencia a las colecciones. Puro (sin
 * Firestore) para poder testear todas las combinaciones sin mockear nada.
 *
 *  - `functionalRole` (QUÉ ERES): define el alcance funcional — tu rama
 *    (supermanager), tu equipo (leader) o tu ficha (engineer). Prioridad por
 *    alcance: supermanager > leader > engineer.
 *  - `instanceAccess` (GOBIERNO, transversal): admin (gobierna y ve todo) o
 *    viewer (ve todo en solo lectura). admin gana a viewer. Es INDEPENDIENTE del
 *    rol funcional: un admin puede además ser manager o ingeniero.
 *  - `role`: el rol único DERIVADO por compatibilidad mientras se migran los
 *    consumidores. Replica EXACTAMENTE la prioridad histórica
 *    superadmin > supermanager > viewer > leader > engineer.
 *
 * @param {{ admin?: boolean, viewer?: boolean, supermanager?: boolean, leader?: boolean, engineer?: boolean }} membership
 * @returns {{ functionalRole: FunctionalRole, instanceAccess: InstanceAccess, role: import('./access.js').AccessRole }}
 */
export function accessAxes(membership = {}) {
  const instanceAccess = membership.admin ? 'admin' : membership.viewer ? 'viewer' : null;
  const functionalRole = membership.supermanager
    ? 'supermanager'
    : membership.leader
      ? 'leader'
      : membership.engineer
        ? 'engineer'
        : null;
  // Compatibilidad: el rol único con la prioridad de siempre.
  const role = instanceAccess === 'admin'
    ? 'superadmin'
    : functionalRole === 'supermanager'
      ? 'supermanager'
      : instanceAccess === 'viewer'
        ? 'viewer'
        : functionalRole; // 'leader' | 'engineer' | null
  return { functionalRole, instanceAccess, role };
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

/**
 * Alcance de rama de un usuario en las tools de equipo (RMR-TSK-0421): si es
 * líder (o supermanager) y ALGUIEN le reporta en /leaders, su ámbito es
 * [él, ...su subárbol transitivo]; si no, null (ámbito de líder simple, la
 * query barata de siempre). Generaliza a todo líder el mecanismo que antes era
 * solo del supermanager — las reglas lo respaldan vía /leaders.chain.
 * @param {{ functionalRole?: string|null }|null} access
 * @param {ReadonlyArray<{ uid?: string, id?: string, reportsTo?: string|null }>} leaders
 * @param {string} uid
 * @returns {string[]|null}
 */
export function branchScopeFor(access, leaders, uid) {
  const role = access?.functionalRole;
  if (role !== 'leader' && role !== 'supermanager') return null;
  const reports = leadersReportingTo(leaders, uid);
  return reports.length > 0 ? [uid, ...reports] : null;
}

/**
 * Cadena de ancestros de cada líder (RMR-TSK-0421): del más cercano al más
 * lejano, siguiendo `reportsTo` hacia arriba. Es la inversa de
 * leadersReportingTo, precomputada para las REGLAS de Firestore (que no pueden
 * recorrer transitividad): `/leaders/{uid}.chain` autoriza la lectura de las
 * personas del subárbol con un solo `in`. Un `reportsTo` hacia un uid sin doc
 * de líder (p. ej. un CPO) entra en la cadena pero la corta ahí; los ciclos
 * accidentales terminan sin duplicar. Pura (sin Firestore) — el espejo de
 * functions/index.js la replica (cross-comment).
 * @param {ReadonlyArray<{ uid?: string, id?: string, reportsTo?: string|null }>} leaders
 * @returns {Map<string, string[]>} uid del líder → uids ancestros (cercano primero)
 */
export function leaderChainsFrom(leaders) {
  const reportsToOf = new Map();
  for (const leader of leaders ?? []) {
    const uid = leader.uid ?? leader.id;
    if (uid != null) reportsToOf.set(uid, leader.reportsTo ?? null);
  }
  const chains = new Map();
  for (const uid of reportsToOf.keys()) {
    const chain = [];
    const seen = new Set([uid]);
    let current = reportsToOf.get(uid);
    while (current != null && !seen.has(current)) {
      chain.push(current);
      seen.add(current);
      current = reportsToOf.get(current) ?? null;
    }
    chains.set(uid, chain);
  }
  return chains;
}
