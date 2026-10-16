/**
 * Lo que se ve de los O2O de una persona sin ser quien los hizo (RMR-TSK-0727).
 * La persona en Mi espacio (getMyO2O) y sus managers en su ficha (getPersonO2O)
 * leen LA MISMA proyección: lo compartido, nunca las notas ni el resumen privado
 * de quien hizo el O2O. Módulo PURO: la Cloud Function lee y llama.
 */

/**
 * Líderes bajo los que puede haber O2O de la persona: su dueño, con quien se
 * compartió y su directorio (EM por equipo, head…).
 * @param {{ ownerLeaderUid?: string|null, sharedWithUids?: Array<string|null>, directoryManagerUids?: string[] }} person
 * @returns {string[]}
 */
export function o2oLeadersOf(person) {
  const all = [person?.ownerLeaderUid, ...(person?.sharedWithUids ?? []), ...(person?.directoryManagerUids ?? [])];
  return [...new Set(all.filter((uid) => typeof uid === 'string' && uid))];
}

/**
 * Las sesiones que su líder marcó como compartidas: fecha, resumen y de quién.
 * Proyección campo a campo: nada de `...session`.
 * @param {Array<{ leaderUid: string, sessions: Array<Record<string, any>> }>} byLeader
 * @returns {Array<{ date: string, sharedSummary: string, leaderUid: string }>}
 */
export function sharedSessions(byLeader) {
  return byLeader
    .flatMap(({ leaderUid, sessions }) => sessions
      .filter((s) => s.sharedWithPerson === true && typeof s.sharedSummary === 'string' && s.sharedSummary.trim())
      .map((s) => ({ date: s.date, sharedSummary: s.sharedSummary, leaderUid })))
    .toSorted((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

/**
 * Los periodos de un líder que son para esta persona: los que la tienen en «Para
 * quién» (`personIds`). Los anteriores a esa lista eran de sus directos: cuentan
 * si el líder es su dueño.
 * @template {{ personIds?: string[] }} P
 * @param {P[]} periods
 * @param {{ personId: string, person: { ownerLeaderUid?: string|null }, leaderUid: string }} who
 * @returns {P[]}
 */
export function periodsForPerson(periods, { personId, person, leaderUid }) {
  return periods.filter((p) => (Array.isArray(p.personIds)
    ? p.personIds.includes(personId)
    : person?.ownerLeaderUid === leaderUid));
}

/**
 * ¿Puede quien llama leer el O2O compartido de esta persona? Sus managers del
 * directorio (los mismos que llevan sus acciones por reglas) y el superadmin.
 * @param {{ callerUid: string|null|undefined, person: { directoryManagerUids?: string[] }|null, isSuperAdmin: boolean }} input
 */
export function canReadPersonO2O({ callerUid, person, isSuperAdmin }) {
  if (!callerUid || !person) return false;
  return isSuperAdmin || (person.directoryManagerUids ?? []).includes(callerUid);
}
