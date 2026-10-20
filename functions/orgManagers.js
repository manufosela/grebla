/**
 * Managers que salen del directorio (RMR-TSK-0660). PURO: la Cloud Function lee
 * y escribe; aquí solo se decide.
 *
 * El directorio ya dice de quién depende cada persona (`reportsToPersonId`),
 * pero el rol de líder va atado a la cuenta (/leaders/{uid}) y muchos managers
 * aún no han entrado nunca. Cuando un manager entra por primera vez y su ficha
 * recibe el uid, recibe también el rol de líder. A quién hace O2O sale de su
 * rama (`directoryManagerUids`, RMR-TSK-0665).
 */

/**
 * Roles que ven a todo su departamento (RMR-TSK-0786). En el organigrama oficial
 * los EMs dependen del CTO y el Head of Tech no tiene a nadie; en GREBLA Head y
 * EM están al mismo nivel (uno lo técnico, otro las personas), así que el Head
 * entra en la rama de cada ficha de su departamento, venga como venga Notion.
 */
export const DEPARTMENT_HEAD_ROLES = Object.freeze(['head-of-tech']);

const isHead = (p) => !!p && DEPARTMENT_HEAD_ROLES.includes(p.orgRole);

/**
 * ¿El cambio de esta ficha mueve el alcance de algún Head? Si la ficha es o era
 * de un Head, o si una ficha que ya existía cambia de departamento o de baja.
 * Crear una ficha normal no (su jefe la recalcula al cambiar reportsToPersonId).
 * @param {Record<string, any>|null} before @param {Record<string, any>} after
 */
export function headScopeChanged(before, after) {
  if (isHead(before) || isHead(after)) {
    return !before || ['orgRole', 'orgBranch', 'active'].some((k) => (before[k] ?? null) !== (after[k] ?? null));
  }
  return !!before && ['orgBranch', 'active'].some((k) => (before[k] ?? null) !== (after[k] ?? null));
}

/** uids de los Heads activos con cuenta, por departamento. */
function headsByBranch(people) {
  const heads = new Map();
  for (const p of people) {
    if (!p.uid || p.active === false || !p.orgBranch || !DEPARTMENT_HEAD_ROLES.includes(p.orgRole)) continue;
    heads.set(p.orgBranch, [...(heads.get(p.orgBranch) ?? []), p.uid]);
  }
  return heads;
}

/**
 * Managers de la rama de cada ficha (RMR-TSK-0661): los uids de todos sus jefes
 * en el directorio que tienen cuenta, del más cercano hacia arriba. Así un CTO
 * ve y hace O2O a toda su rama sin tener que apuntarse persona a persona. Tras
 * la cadena, el Head de su departamento si la ficha está activa (RMR-TSK-0786).
 * Se guarda en `directoryManagerUids`. Devuelve solo las fichas cuya lista cambia.
 * @param {ReadonlyArray<{ id: string, uid?: string|null, reportsToPersonId?: string|null,
 *   orgBranch?: string|null, orgRole?: string|null, active?: boolean, directoryManagerUids?: string[] }>} people
 * @returns {Array<{ id: string, uids: string[] }>}
 */
export function directoryManagerPatches(people) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const heads = headsByBranch(people);
  const patches = [];
  for (const person of people) {
    const uids = [];
    const seen = new Set([person.id]);
    let boss = byId.get(person.reportsToPersonId ?? '');
    while (boss && !seen.has(boss.id)) {
      seen.add(boss.id);
      if (boss.uid) uids.push(boss.uid);
      boss = byId.get(boss.reportsToPersonId ?? '');
    }
    if (person.active !== false) {
      for (const uid of heads.get(person.orgBranch) ?? []) if (uid !== person.uid && !uids.includes(uid)) uids.push(uid);
    }
    const current = person.directoryManagerUids ?? null;
    const same = Array.isArray(current) && current.length === uids.length && current.every((u, i) => u === uids[i]);
    if (!same) patches.push({ id: person.id, uids });
  }
  return patches;
}

/**
 * @param {string} personId  ficha que acaba de recibir uid
 * @param {string|null} uid
 * @param {ReadonlyArray<{ id: string, name?: string, reportsToPersonId?: string|null,
 *   active?: boolean }>} people
 * @param {boolean} leaderExists  ¿existe ya /leaders/{uid}?
 * @returns {{ leader: { uid: string, displayName: string|null }|null }}
 */
export function managerOnboardingPlan(personId, uid, people, leaderExists) {
  const hasReports = people.some((p) => p.reportsToPersonId === personId && p.active !== false);
  if (!uid || !hasReports || leaderExists) return { leader: null };
  const me = people.find((p) => p.id === personId);
  return { leader: { uid, displayName: me?.name ?? null } };
}
