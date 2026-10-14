/**
 * EM por equipo (RMR-TSK-0717). Dominio PURO del editor del superadmin: qué
 * equipos de Tech hay y quién puede ser su EM. La regla que aplica el EM vive en
 * functions/teamEms.js (las Cloud Functions no importan de src).
 */

const TECH = 'engineering';
const isActiveTech = (p) => p?.active !== false && p?.orgBranch === TECH;
const byName = (a, b) => a.name.localeCompare(b.name, 'es');

/**
 * @param {ReadonlyArray<{ id: string, name?: string, active?: boolean, orgBranch?: string,
 *   notion?: { level?: string, team?: string } }>} people
 * @returns {{ teams: string[], candidates: Array<{ id: string, name: string }> }}
 */
export function teamEmChoices(people) {
  const tech = (people ?? []).filter(isActiveTech);
  const teams = [...new Set(tech.map((p) => p.notion?.team).filter(Boolean))].toSorted((a, b) => a.localeCompare(b, 'es'));
  const candidates = tech.filter((p) => p.notion?.level === 'Manager')
    .map((p) => ({ id: p.id, name: p.name ?? p.id })).toSorted(byName);
  return { teams, candidates };
}

/**
 * El mapa que se guarda: solo equipos con un EM que existe.
 * @param {Record<string, string>} draft
 * @param {string[]} candidateIds
 * @returns {Record<string, string>}
 */
export function cleanTeamEms(draft, candidateIds) {
  const valid = new Set(candidateIds);
  return Object.fromEntries(Object.entries(draft ?? {}).filter(([, id]) => valid.has(id)));
}
