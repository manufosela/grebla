/**
 * Managers que salen del directorio (RMR-TSK-0660). PURO: la Cloud Function lee
 * y escribe; aquí solo se decide.
 *
 * El directorio ya dice de quién depende cada persona (`reportsToPersonId`),
 * pero el rol de líder va atado a la cuenta (/leaders/{uid}) y muchos managers
 * aún no han entrado nunca. Cuando un manager entra por primera vez y su ficha
 * recibe el uid, recibe también el rol de líder y queda como manager de O2O de
 * su equipo. Después, la lista de O2O la ajusta el superadmin a mano.
 */

/**
 * @param {string} personId  ficha que acaba de recibir uid
 * @param {string|null} uid
 * @param {ReadonlyArray<{ id: string, name?: string, reportsToPersonId?: string|null,
 *   active?: boolean, o2oManagerUids?: string[] }>} people
 * @param {boolean} leaderExists  ¿existe ya /leaders/{uid}?
 * @returns {{ leader: { uid: string, displayName: string|null }|null, addO2OTo: string[] }}
 */
export function managerOnboardingPlan(personId, uid, people, leaderExists) {
  if (!uid) return { leader: null, addO2OTo: [] };
  const reports = people.filter((p) => p.reportsToPersonId === personId && p.active !== false);
  if (reports.length === 0) return { leader: null, addO2OTo: [] };
  const me = people.find((p) => p.id === personId);
  return {
    leader: leaderExists ? null : { uid, displayName: me?.name ?? null },
    addO2OTo: reports.filter((p) => !(p.o2oManagerUids ?? []).includes(uid)).map((p) => p.id),
  };
}
