/**
 * Quién sale en Mi equipo (RMR-TSK-0747). PURO.
 *
 * Manda el organigrama: quien tiene sitio en él (`reportsToPersonId`) sale a
 * todos los que tiene por encima (`directoryManagerUids`, que calcula el
 * trigger) y a nadie más, aunque su ficha la diera de alta otro manager. Así
 * dejan de colarse en el equipo de alguien personas de otros departamentos.
 *
 * Quien no está en el organigrama (externos sin jefe, instancias sin Notion)
 * sigue como siempre: con su dueño, con quien se compartió o con la rama de
 * managers que le reportan.
 *
 * @param {{ reportsToPersonId?: string|null, directoryManagerUids?: string[],
 *   ownerLeaderUid?: string|null, sharedWithUids?: Array<string|null> }} person
 * @param {string} uid  quien mira
 * @param {string[]|null} [branchLeaderUids]  managers de su rama, si es head
 * @returns {boolean}
 */
export function inMyTeam(person, uid, branchLeaderUids = null) {
  if (person.reportsToPersonId) return (person.directoryManagerUids ?? []).includes(uid);
  if (person.ownerLeaderUid === uid || (person.sharedWithUids ?? []).includes(uid)) return true;
  return (branchLeaderUids ?? []).includes(person.ownerLeaderUid ?? '');
}
